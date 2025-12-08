const fileInput = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const downloadLink = document.getElementById('downloadLink');

let workbook;

// Enable convert button when file is selected
fileInput.addEventListener('change', () => {
    if (fileInput.files.length > 0) {
        convertBtn.disabled = false;
        progressBar.style.width = '0%';
        progressText.textContent = '';
        downloadLink.style.display = 'none';
    }
});

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
        await new Promise(r => setTimeout(r, 10));
    }

    const blob = new Blob([outputLines.join('\n')], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    downloadLink.href = url;
    downloadLink.download = 'output.jsonl';
    downloadLink.style.display = 'inline-block';
    progressText.textContent = `Done! ${jsonData.length} rows processed.`;
});

// ------------------- Conversion Logic -------------------
function convertChunk(rows) {
    const countryNameMap = {
        "russia": "Russian Federation",
        "united states": "United States",
        "united kingdom": "United Kingdom",
        "iran": "Iran, Islamic Republic of",
        "korea, north": "Korea, Democratic People's Republic of",
        "korea, south": "Korea, Republic of",
        "palestine": "Palestine, State of",
        "vietnam": "Viet Nam",
        "syria": "Syrian Arab Republic",
        "tanzania": "Tanzania, United Republic of",
        "venezuela": "Venezuela, Bolivarian Republic of",
        "turkey": "Türkiye",
        "democratic republic of the congo": "Congo, The Democratic Republic of the",
        "congo republic": "Congo",
        "macau": "Macao, S.A.R., China"
    };

    function countryToISO(name) {
        if (!name) return null;
        const lower = name.toLowerCase();
        const mapped = countryNameMap[lower] || name;
        try {
            return countries.getAlpha2Code(mapped, "en") || mapped;
        } catch(e) {
            return mapped;
        }
    }

    function buildAddress(row) {
        const country = countryToISO(row["Address Country"]);
        if (!country) return [];
        const addr = { countryCode: country };
        if (row["Address Line"]) addr.line = row["Address Line"];
        if (row["Address City"]) addr.city = row["Address City"];
        if (row["Address State"]) addr.province = row["Address State"];
        return [addr];
    }

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
        rec.citizenshipCode = row["Address Country"] ? [countryToISO(row["Address Country"])] : [];
        rec.residentOfCode = row["Address Country"] ? [countryToISO(row["Address Country"])] : [];
        rec.countryOfRegistrationCode = row["Address Country"] ? [countryToISO(row["Address Country"])] : [];
        rec.lists = buildLists(row);
        rec.activeStatus = "Active";

        if (rec.type === "company") {
            delete rec.citizenshipCode;
            delete rec.residentOfCode;
            delete rec.dateOfBirthArray;
        } else if (rec.type === "person") {
            delete rec.countryOfRegistrationCode;
        }

        for (const k of Object.keys(rec)) {
            if (rec[k] === null || (Array.isArray(rec[k]) && rec[k].length === 0) || rec[k] === '') {
                delete rec[k];
            }
        }

        output.push(JSON.stringify(rec));
    }

    return output;
}

function formatDate(date) {
    try {
        const d = new Date(date);
        if (isNaN(d)) return null;
        return d.toISOString().split('T')[0];
    } catch (e) { return null; }
}
