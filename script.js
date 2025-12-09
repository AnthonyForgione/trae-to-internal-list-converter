// --- SCRIPT.JS ---
// Assumes countries.js defines `COUNTRY_DATA` as { name: "...", alpha2: "..." }

// --- BASIC UTILITIES ---
function normalize(str) {
  return String(str || "").trim().toLowerCase();
}

// --- COUNTRY ISO CONVERSION ---
function countryToISO(country) {
  if (!country) return null;
  const value = normalize(country);
  const match = COUNTRY_DATA.find(c => normalize(c.name) === value);
  return match ? match.alpha2 : null;
}

// --- DATE CONVERSION ---
function formatDate(value) {
  if (!value) return [];
  const d = new Date(value);
  if (isNaN(d)) return [];
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return [`${yyyy}-${mm}-${dd}`];
}

// --- LIST REFERENCE DETAILS ---
function buildLists(refString) {
  const parentId = "TRAE-Import-File";
  const parentName = "TRAE Import File";

  const finalLists = [{
    active: true,
    hierarchy: [{ id: parentId, name: parentName }],
    id: parentId,
    listActive: true,
    name: parentName
  }];

  if (!refString || !refString.trim() || refString.toLowerCase() === "nan") return finalLists;

  const refs = refString.split("|").map(r => r.trim()).filter(r => r);
  refs.forEach(refName => {
    const dynamicId = refName.toUpperCase()
      .replace(/\s+/g, "-")
      .replace(/[\[\]\/:]/g, "");
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

// --- ALIASES ---
function buildAliases(row, aliasCols) {
  const aliases = [];
  aliasCols.forEach(col => {
    const value = row[col];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      aliases.push({ name: String(value).trim() });
    }
  });
  return aliases.length ? aliases : undefined;
}

// --- TRANSFORM ROW ---
function transformRow(row) {
  const out = {};

  // 1. profileId
  if (row.PersonentityID !== undefined && row.PersonentityID !== null && String(row.PersonentityID).trim() !== "") {
    out.profileId = "TRAE" + String(row.PersonentityID).trim();
  }

  // 2. type
  let type = row["Record Type"];
  if (type) {
    const t = String(type).trim().toLowerCase();
    out.type = t === "entity" ? "company" : t === "person" ? "person" : t;
  }

  // 3. Other direct mappings
  const directMap = {
    "Action Type": "action",
    "Gender": "gender",
    "Deceased": "deceased",
    "Primary Name": "name",
    "TAE Profile Notes": "profileNotes",
    "Date of Birth": "dateOfBirthArray",
    "List Reference Details": "lists"
  };

  for (const [key, mapped] of Object.entries(directMap)) {
    if (row[key] !== undefined && row[key] !== null && String(row[key]).trim() !== "") {
      if (mapped === "dateOfBirthArray") {
        out[mapped] = formatDate(row[key]);
      } else if (mapped === "lists") {
        out[mapped] = buildLists(row[key]);
      } else {
        out[mapped] = row[key];
      }
    }
  }

  // 4. Address
  if (row["Address Country"] && String(row["Address Country"]).trim() !== "") {
    const iso = countryToISO(row["Address Country"]);
    if (iso) {
      const addr = { countryCode: iso };
      if (row["Address Line"] && String(row["Address Line"]).trim() !== "") addr.line = row["Address Line"];
      if (row["Address City"] && String(row["Address City"]).trim() !== "") addr.city = row["Address City"];
      if (row["Address State"] && String(row["Address State"]).trim() !== "") addr.province = row["Address State"];
      out.addresses = [addr];
    }
  }

  // 5. citizenshipCode / residentOfCode / countryOfRegistrationCode
  if (row["Address Country"] && String(row["Address Country"]).trim() !== "") {
    const iso = countryToISO(row["Address Country"]);
    if (iso) {
      out.citizenshipCode = [iso];
      out.residentOfCode = [iso];
      out.countryOfRegistrationCode = [iso];
    }
  }

  // 6. aliases
  const aliasCols = Object.keys(row).filter(c => c.startsWith("Also Known As[") && c.endsWith("]"));
  const aliases = buildAliases(row, aliasCols);
  if (aliases) out.aliases = aliases;

  // 7. activeStatus
  out.activeStatus = "Active";

  // 8. Conditional key omission
  if (out.type === "company") {
    delete out.citizenshipCode;
    delete out.residentOfCode;
    delete out.dateOfBirthArray;
  } else if (out.type === "person") {
    delete out.countryOfRegistrationCode;
  }

  return out;
}

// --- FILE HANDLING ---
const fileInput = document.getElementById("fileInput");
const convertBtn = document.getElementById("convertBtn");
const downloadLink = document.getElementById("downloadLink");
const progressText = document.getElementById("progressText");

fileInput.addEventListener("change", () => {
  convertBtn.disabled = !fileInput.files.length;
  progressText.textContent = fileInput.files.length ? `${fileInput.files[0].name} selected` : "No file selected";
});

convertBtn.addEventListener("click", () => {
  if (!fileInput.files.length) return;
  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = e => {
    const data = new Uint8Array(e.target.result);
    const wb = XLSX.read(data, { type: "array" });
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

  reader.readAsArrayBuffer(file);
});
