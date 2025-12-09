// --- SCRIPT.JS ---
// Assumes countries.js defines: const COUNTRY_DATA = [{name:..., alpha2:...}, ...]

// --- BASIC UTILITIES ---
function normalize(str) {
  return String(str || "").trim().toLowerCase();
}

function isEmptyValue(val) {
  return (
    val === undefined ||
    val === null ||
    (typeof val === "string" && val.trim() === "") ||
    (Array.isArray(val) && val.length === 0) ||
    (val.constructor === Object && Object.keys(val).length === 0)
  );
}

// --- COUNTRY TO ISO (uses COUNTRY_DATA) ---
function countryToIso(name) {
  if (!name) return null;
  const lower = normalize(name);
  const entry = COUNTRY_DATA.find(c => normalize(c.name) === lower);
  return entry ? entry.alpha2 : null;
}

// --- TRANSFORMATIONS ---
function transformRow(row) {
  const out = {};

  // 1. profileId
  if ("PersonentityID" in row && !isEmptyValue(row["PersonentityID"])) {
    out.profileId = "TRAE" + String(row["PersonentityID"]).trim();
  }

  // 2. type
  if ("Record Type" in row && !isEmptyValue(row["Record Type"])) {
    const t = String(row["Record Type"]).trim().toLowerCase();
    out.type = t === "entity" ? "company" : t === "person" ? "person" : t;
  }

  // 3. action
  if ("Action Type" in row && !isEmptyValue(row["Action Type"])) {
    out.action = String(row["Action Type"]).trim();
  }

  // 4. name & profileNotes
  if ("Primary Name" in row && !isEmptyValue(row["Primary Name"])) {
    out.name = String(row["Primary Name"]).trim();
  }
  if ("TAE Profile Notes" in row && !isEmptyValue(row["TAE Profile Notes"])) {
    out.profileNotes = String(row["TAE Profile Notes"]).trim();
  }

  // 5. gender & deceased
  if ("Gender" in row && !isEmptyValue(row["Gender"])) out.gender = String(row["Gender"]).trim();
  if ("Deceased" in row && !isEmptyValue(row["Deceased"])) out.deceased = String(row["Deceased"]).trim();

  // 6. dateOfBirth -> dateOfBirthArray
  if ("Date of Birth" in row && !isEmptyValue(row["Date of Birth"])) {
    const d = new Date(row["Date of Birth"]);
    if (!isNaN(d)) out.dateOfBirthArray = [d.toISOString().slice(0, 10)];
  }

  // 7. addresses
  const countryCode = countryToIso(row["Address Country"]);
  if (countryCode) {
    const addr = { countryCode };
    if (!isEmptyValue(row["Address Line"])) addr.line = String(row["Address Line"]).trim();
    if (!isEmptyValue(row["Address City"])) addr.city = String(row["Address City"]).trim();
    if (!isEmptyValue(row["Address State"])) addr.province = String(row["Address State"]).trim();
    out.addresses = [addr];
  }

  // 8. citizenshipCode, residentOfCode, countryOfRegistrationCode
  if (countryCode) {
    out.citizenshipCode = [countryCode];
    out.residentOfCode = [countryCode];
    out.countryOfRegistrationCode = [countryCode];
  }

  // 9. lists (list_reference_details)
  const parentId = "TRAE-Import-File";
  const parentName = "TRAE Import File";
  const finalLists = [{
    active: true,
    hierarchy: [{ id: parentId, name: parentName }],
    id: parentId,
    listActive: true,
    name: parentName
  }];
  if ("list_reference_details" in row && !isEmptyValue(row["list_reference_details"])) {
    const refs = String(row["list_reference_details"]).split("|").map(r => r.trim()).filter(r => r);
    refs.forEach(ref => {
      const childId = ref.toUpperCase().replace(/[\s\[\]\/:]/g, "-");
      finalLists.push({
        active: true,
        hierarchy: [
          { id: parentId, name: parentName },
          { id: childId, name: ref, parent: parentId }
        ],
        id: childId,
        listActive: true,
        name: ref
      });
    });
  }
  out.lists = finalLists;

  // 10. aliases
  const aliasCols = Object.keys(row).filter(k => k.startsWith("Also Known As[") && k.endsWith("]"));
  const aliases = [];
  aliasCols.forEach(col => {
    if (!isEmptyValue(row[col])) aliases.push({ name: String(row[col]).trim() });
  });
  if (aliases.length > 0) out.aliases = aliases;

  // 11. activeStatus
  out.activeStatus = "Active";

  // 12. Conditional key omission
  if (out.type === "company") {
    delete out.citizenshipCode;
    delete out.residentOfCode;
    delete out.dateOfBirthArray;
  } else if (out.type === "person") {
    delete out.countryOfRegistrationCode;
  }

  // 13. Remove any other empty fields
  Object.keys(out).forEach(k => {
    if (isEmptyValue(out[k])) delete out[k];
  });

  return out;
}

// --- FILE HANDLING ---
const fileInput = document.getElementById("fileInput");
const convertBtn = document.getElementById("convertBtn");
const progressText = document.getElementById("progressText");
const downloadLink = document.getElementById("downloadLink");

fileInput.addEventListener("change", () => {
  convertBtn.disabled = !fileInput.files.length;
  progressText.textContent = fileInput.files.length ? "File selected: " + fileInput.files[0].name : "No file selected.";
});

convertBtn.addEventListener("click", () => {
  if (!fileInput.files.length) return;
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(e.target.result, { type: "binary" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: null });

    const transformed = json.map(transformRow);
    const jsonl = transformed.map(obj => JSON.stringify(obj)).join("\n");
    const blob = new Blob([jsonl], { type: "text/plain" });

    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = "output.jsonl";
    downloadLink.style.display = "inline-block";
    downloadLink.textContent = "Download JSONL";

    progressText.textContent = "Conversion complete!";

    convertBtn.disabled = true;
  };
  reader.readAsBinaryString(file);
});
