// --- SCRIPT.JS FOR TRAE XLS TO JSONL ---

// --- Grab elements
const fileInput = document.getElementById("fileInput");
const convertBtn = document.getElementById("convertBtn");
const progressText = document.getElementById("progressText");
const downloadLink = document.getElementById("downloadLink");

// --- Enable button on file select
fileInput.addEventListener("change", () => {
  convertBtn.disabled = fileInput.files.length === 0;
  progressText.textContent = fileInput.files.length ? fileInput.files[0].name : "No file selected.";
});

// --- Utilities ---
function isEmpty(value) {
  return value === null || value === undefined || value === "" ||
         (Array.isArray(value) && value.length === 0) ||
         (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0);
}

function formatDateToISO(dateVal) {
  if (!dateVal) return [];
  const date = new Date(dateVal);
  if (isNaN(date)) return [];
  return [date.toISOString().slice(0, 10)]; // YYYY-MM-DD
}

// --- Type transform
function transformType(val) {
  if (!val) return null;
  const t = String(val).toLowerCase().trim();
  if (t === "entity") return "company";
  if (t === "person") return "person";
  return val;
}

// --- Address building
function buildAddress(row) {
  const country = row["Address Country"];
  const iso = fuzzyCountryMatch(country);
  if (!iso) return [];
  const addr = { countryCode: iso };
  if (row["Address Line"]) addr.line = String(row["Address Line"]).trim();
  if (row["Address City"]) addr.city = String(row["Address City"]).trim();
  if (row["Address State"]) addr.province = String(row["Address State"]).trim();
  return [addr];
}

// --- Lists building
function buildLists(row) {
  const refRaw = row["list_reference_details"];
  const parentId = "TRAE-Import-File";
  const parentName = "TRAE Import File";

  const finalLists = [{
    active: true,
    hierarchy: [{ id: parentId, name: parentName }],
    id: parentId,
    listActive: true,
    name: parentName
  }];

  if (!refRaw || String(refRaw).toLowerCase() === "nan") return finalLists;

  const refs = String(refRaw).split("|").map(r => r.trim()).filter(r => r);
  refs.forEach(refName => {
    const dynamicId = refName.toUpperCase()
      .replace(/ /g, "-")
      .replace(/\[|\]/g, "")
      .replace(/\//g, "-")
      .replace(/:/g, "");

    finalLists.push({
      active: true,
      hierarchy: [
        { id: parentId, name: parentName },
        { id: dynamicId, name: refName, parent: parentId }
      ],
      id: dynamicId,
      listActive: true,
      name: refName
    });
  });

  return finalLists;
}

// --- Aliases building
function buildAliases(row, aliasCols) {
  const aliases = [];
  aliasCols.forEach(col => {
    if (row[col] && String(row[col]).trim() !== "") {
      aliases.push({ name: String(row[col]).trim() });
    }
  });
  return aliases;
}

// --- Main transform function
function transformRow(row, aliasCols) {
  const out = {};

  // Field renaming
  const MAPPINGS = {
    "PersonentityID": "profileId",
    "Record Type": "type",
    "Action Type": "action",
    "Gender": "gender",
    "Deceased": "deceased",
    "Primary Name": "name",
    "TAE Profile Notes": "profileNotes",
    "Date of Birth": "dateOfBirth",
    "List Reference Details": "list_reference_details"
  };

  for (const key in MAPPINGS) {
    if (row[key] !== undefined && row[key] !== null) {
      out[MAPPINGS[key]] = row[key];
    }
  }

  // --- Profile ID fix
  if (out.profileId) out.profileId = "TRAE" + String(out.profileId).trim();

  // --- Type
  out.type = transformType(out.type);

  // --- dateOfBirthArray
  out.dateOfBirthArray = formatDateToISO(out.dateOfBirth);

  // --- addresses
  out.addresses = buildAddress(row);

  // --- citizenship/residentOf/countryOfRegistration
  const iso = fuzzyCountryMatch(row["Address Country"]);
  out.citizenshipCode = iso ? [iso] : [];
  out.residentOfCode = iso ? [iso] : [];
  out.countryOfRegistrationCode = iso ? [iso] : [];

  // --- lists
  out.lists = buildLists(row);

  // --- aliases
  out.aliases = buildAliases(row, aliasCols);

  // --- activeStatus
  out.activeStatus = "Active";

  // --- Clean empty fields based on Python rules
  const cleaned = {};
  for (const k in out) {
    if (out.type === "company" && ["citizenshipCode","residentOfCode","dateOfBirthArray"].includes(k)) continue;
    if (out.type === "person" && k === "countryOfRegistrationCode") continue;
    if (!isEmpty(out[k])) cleaned[k] = out[k];
  }

  return cleaned;
}

// --- Convert Button Handler
convertBtn.addEventListener("click", () => {
  const file = fileInput.files[0];
  if (!file) {
    alert("Please select a file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = e => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json(sheet, { defval: null });

    // --- Detect alias columns
    const aliasCols = Object.keys(json[0] || {}).filter(c => c.startsWith("Also Known As[") && c.endsWith("]"));

    const transformed = json.map(row => transformRow(row, aliasCols));

    // --- JSONL
    const jsonl = transformed.map(r => JSON.stringify(r)).join("\n");
    const blob = new Blob([jsonl], { type: "text/plain" });

    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = "output.jsonl";
    downloadLink.style.display = "inline-block";
    downloadLink.textContent = "Download JSONL";
    progressText.textContent = "Conversion complete!";
  };

  reader.readAsArrayBuffer(file);
});
