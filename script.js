// ----------------------------
// script.js
// ----------------------------

// --- UTILITIES ---
function isEmpty(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === "string" && value.trim() === "") return true;
  if (Array.isArray(value) && value.length === 0) return true;
  if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return true;
  return false;
}

function normalize(str) {
  return String(str || "").trim().toLowerCase();
}

function formatDateToISO(dateVal) {
  if (!dateVal) return [];
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return [];
  return [d.toISOString().split("T")[0]]; // YYYY-MM-DD
}

// --- COUNTRY ISO LOOKUP ---
function countryToISO(countryName) {
  if (!countryName) return null;
  const val = normalize(countryName);

  // Check map (COUNTRY_DATA should be defined in countries.js)
  for (let c of COUNTRY_DATA) {
    if (normalize(c.name) === val) return c.alpha2;
    if (c.aliases && c.aliases.some(a => normalize(a) === val)) return c.alpha2;
  }

  return null;
}

// --- FIELD TRANSFORMATION ---
function transformType(recordType) {
  if (!recordType) return null;
  const typeLower = normalize(recordType);
  if (typeLower === "entity") return "company";
  if (typeLower === "person") return "person";
  return recordType;
}

function buildAddress(row) {
  const isoCountry = countryToISO(row["Address Country"]);
  if (!isoCountry) return [];

  const address = { countryCode: isoCountry };
  const optionalFields = {
    line: row["Address Line"],
    city: row["Address City"],
    province: row["Address State"]
  };

  for (let key in optionalFields) {
    if (!isEmpty(optionalFields[key])) address[key] = optionalFields[key].toString().trim();
  }

  return [address];
}

function buildLists(row) {
  const refRaw = row["list_reference_details"];
  const refString = refRaw ? refRaw.toString().trim() : "";

  const parentId = "TRAE-Import-File";
  const parentName = "TRAE Import File";

  const finalLists = [{
    active: true,
    hierarchy: [{ id: parentId, name: parentName }],
    id: parentId,
    listActive: true,
    name: parentName
  }];

  if (!refString || refString.toLowerCase() === "nan") return finalLists;

  const listRefs = refString.split("|").map(r => r.trim()).filter(r => r);

  listRefs.forEach(refName => {
    const dynamicId = refName.toUpperCase().replace(/ /g, "-").replace(/\[/g, "").replace(/\]/g, "").replace(/\//g, "-").replace(/:/g, "");
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

function buildAliases(row, aliasColumns) {
  const aliases = [];
  aliasColumns.forEach(col => {
    const val = row[col];
    if (!isEmpty(val)) aliases.push({ name: val.toString().trim() });
  });
  return aliases;
}

// --- MAIN TRANSFORMATION ---
function transformRow(row, aliasColumns) {
  const newRow = {};

  // Profile ID
  if (row["PersonentityID"]) newRow.profileId = "TRAE" + row["PersonentityID"].toString().trim();

  // Direct mappings
  const mappings = {
    "Record Type": "type",
    "Action Type": "action",
    "Gender": "gender",
    "Deceased": "deceased",
    "Primary Name": "name",
    "TAE Profile Notes": "profileNotes",
    "Date of Birth": "dateOfBirth",
    "List Reference Details": "list_reference_details"
  };

  for (let key in mappings) {
    if (!isEmpty(row[key])) newRow[mappings[key]] = row[key];
  }

  // Type conversion
  if (newRow.type) newRow.type = transformType(newRow.type);

  // Date of birth
  newRow.dateOfBirthArray = newRow.dateOfBirth ? formatDateToISO(newRow.dateOfBirth) : [];

  // Addresses
  newRow.addresses = buildAddress(row);

  // Citizenship / residentOf / countryOfRegistrationCode
  const isoCountry = countryToISO(row["Address Country"]);
  newRow.citizenshipCode = isoCountry ? [isoCountry] : [];
  newRow.residentOfCode = isoCountry ? [isoCountry] : [];
  newRow.countryOfRegistrationCode = isoCountry ? [isoCountry] : [];

  // Lists
  newRow.lists = buildLists(row);

  // Aliases
  newRow.aliases = buildAliases(row, aliasColumns);

  // Always active
  newRow.activeStatus = "Active";

  return newRow;
}

// --- JSONL EXPORT & CLEANUP ---
function cleanRecord(record) {
  const type = record.type;

  // Conditional key omission
  if (type === "company") {
    delete record.citizenshipCode;
    delete record.residentOfCode;
    delete record.dateOfBirthArray;
  } else if (type === "person") {
    delete record.countryOfRegistrationCode;
  }

  // Remove empty keys
  for (let key in record) {
    if (["citizenshipCode", "residentOfCode", "countryOfRegistrationCode"].includes(key)) continue;
    if (isEmpty(record[key])) delete record[key];
  }

  return record;
}

// --- FILE HANDLING ---
document.getElementById("convertBtn").addEventListener("click", () => {
  const file = document.getElementById("fileInput").files[0];
  if (!file) return alert("Please upload a file");

  const reader = new FileReader();
  reader.onload = e => {
    const wb = XLSX.read(e.target.result, { type: "binary" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Detect alias columns
    const aliasColumns = Object.keys(data[0] || {}).filter(c => c.startsWith("Also Known As[") && c.endsWith("]"));

    // Transform rows
    let transformed = data.map(r => transformRow(r, aliasColumns));
    transformed = transformed.map(cleanRecord);

    // Create JSONL
    const lines = transformed.map(r => JSON.stringify(r)).join("\n");
    const blob = new Blob([lines], { type: "text/plain" });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "output.jsonl";
    a.click();
  };

  reader.readAsBinaryString(file);
});
