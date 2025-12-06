const countryMap = {
    "russia": "RU", "united states": "US", "united kingdom": "GB",
    "iran": "IR", "korea, north": "KP", "korea, south": "KR",
    "palestine": "PS", "vietnam": "VN", "syria": "SY",
    "tanzania": "TZ", "venezuela": "VE", "turkey": "TR",
    "democratic republic of the congo": "CD", "congo republic": "CG",
    "macau": "MO"
};

document.getElementById("convertBtn").addEventListener("click", () => {
    const fileInput = document.getElementById("fileInput");
    const message = document.getElementById("message");
    message.textContent = "";

    if (!fileInput.files.length) {
        message.style.color = "red";
        message.textContent = "Please select an Excel file to convert.";
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        let json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

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

        json = json.map(row => {
            // --- Rename fields ---
            for (let key in MAPPINGS) {
                if (row[key] !== undefined) {
                    row[MAPPINGS[key]] = row[key];
                    delete row[key];
                }
            }

            // --- Add TRAE prefix ---
            if (row.profileId) row.profileId = "TRAE" + String(row.profileId).trim();

            // --- Type transformation ---
            if (row.type) {
                const t = String(row.type).toLowerCase().trim();
                if (t === "entity") row.type = "company";
                else if (t === "person") row.type = "person";
