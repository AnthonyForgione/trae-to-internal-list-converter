// ------------------------- VARIABLES -------------------------
const fileInput = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const downloadLink = document.getElementById('downloadLink');

let workbook;

// -------------------- ENABLE BUTTON --------------------
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        convertBtn.disabled = false;
        progressBar.style.width = '0%';
        progressText.textContent = '';
        downloadLink.style.display = 'none';
    }
});

// -------------------- CONVERT BUTTON --------------------
convertBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
        alert("Please select a file first!");
        return;
    }

    const data = await file.arrayBuffer();
    workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: null });

    const chunkSize = 500;
    let outputLines = [];

    for (let i = 0; i < jsonData.length; i += chunkSize) {
        const chunk = jsonData.slice(i, i + chunkSize);
        const converted = convertChunk(chunk);
        outputLines = outputLines.concat(converted);

        const progress = Math.min(100, Math.floor(((i + chunk.length) / jsonData.length) * 100));
        progressBar.style.width = `${progress}%`;
        progressText.textContent = `Processing: ${progress}%`;
        await new Promise(r => setTimeout(r, 10)); // allow UI update
    }

    const blob = new Blob([outputLines.join('\n')], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    downloadLink.href = url;
    downloadLink.download = 'output.jsonl';
    downloadLink.style.display = 'inline-block';
    progressText.textContent = `Done! ${jsonData.length} rows processed.`;
});

// -------------------- CONVERSION LOGIC --------------------
function convertChunk(rows) {

    // -------------------- COUNTRY ISO --------------------
    function countryToISO(name) {
        if (!name) return null;
        const lower = name.toLowerCase();

        // Fix known mismatches
        const fixes = {
            "north korea": "KP",
            "south korea": "KR",
            "iran": "IR",
            "russia": "RU",
            "syria": "SY",
            "tanzania": "TZ",
            "venezuela": "VE",
            "turkey": "TR",
            "macau": "MO",
            "palestine": "PS",
            "democratic republic of the congo": "CD",
            "congo republic": "CG",
            "vietnam": "VN"
        };
        if (fixes[lower]) return fixes[lower];

        // i18n-iso-countries lookup
        const code = countries.getAlpha2Code(name, "en");
        if (code) return code;

        // Fuzzy search fallback
        try {
            const fuzzy = countries.searchFuzzy(name);
            if (fuzzy && fuzzy.length > 0) return fuzzy[0].alpha2;
        } catch (e) { }

        return null; // fallback
    }

    // -------------------- BUILD ADDRESS --------------------
    function buildAddress(row) {
        const iso = countryToISO(row["Address Country"]);
        if (!iso) return [];

        const addr = { countryCode: iso };
        if (row["Address Line"]) addr.line = row["Address Line"];
        if (row["Address City"]) addr.city = row["Address City"];
        if (row["Address State"]) addr.province = row["Address State"];

        return [addr];
    }

    // -------------------- BUILD LISTS --------------------
    function buildLists(row) {
        const parentId = "TRAE-Import-File";
        const parentName = "TRAE Import File";
        let lists = [{
            active: true,
            hierarchy: [{ id: parentId, name: parentName }],
            id: parentId,
            listActive: true,
            name: parentName
        }];

        if (!row["List Reference Details"]) return lists;

        const refs = String(row["List Reference Details"]).split('|').map(r => r.trim()).filter(r => r);
        refs.forEach(r => {
            const childId = r.toUpperCase().replace(/[\s\[\]/:]/g, '-');
            lists.push({
                active: true,
                hierarchy: [{ id: parentId, name: parentName }, { id: childId, name: r, parent: parentId }],
                id: childId,
                listActive: true,
                name: r
            });
        });

        return lists;
    }

    // -------------------- PROCESS ROWS --------------------
    const output = [];

    for (const row of rows) {
        let rec = {};
        rec.profileId = row["PersonentityID"] ? `TRAE${String(row["PersonentityID"]).trim()}` : null;
        rec.type = row["Record Type"] ? String(row["Record Type"]).toLowerCase().trim() === "entity" ? "company" : "person" : null;
        rec.action = row["Action Type"] || null;
        rec.gender = row["Gender"] || null;
        rec.deceased = row["Deceased"] || null;
        rec.name = row["Primary Name"] || null;
        rec.profileNotes = row["TAE Profile Notes"] || null;
        rec.dateOfBirthArray = row["Date of Birth"] ? [formatDate(row["Date of Birth"])] : [];
        rec.addresses = buildAddress(row);

        const iso = countryToISO(row["Address Country"]);
        rec.citizenshipCode = iso ? [iso] : [];
        rec.residentOfCode = iso ? [iso] : [];
        rec.countryOfRegistrationCode = iso ? [iso] : [];

        rec.lists = buildLists(row);
        rec.activeStatus = "Active";

        // Key omission
        if (rec.type === "company") {
            delete rec.citizenshipCode;
            delete rec.residentOfCode;
            delete rec.dateOfBirthArray;
        } else if (rec.type === "person") {
            delete rec.countryOfRegistrationCode;
        }

        // Remove empty keys
        for (const k of Object.keys(rec)) {
            if (rec[k] === null || (Array.isArray(rec[k]) && rec[k].length === 0) || rec[k] === '') {
                delete rec[k];
            }
        }

        output.push(JSON.stringify(rec));
    }

    return output;
}

// -------------------- FORMAT DATE --------------------
function formatDate(date) {
    try {
        const d = new Date(date);
        if (isNaN(d)) return null;
        return d.toISOString().split('T')[0];
    } catch (e) { return null; }
}
