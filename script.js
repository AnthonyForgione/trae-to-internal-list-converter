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
            }

            // --- Date of Birth ---
            if (row.dateOfBirth) {
                const d = new Date(row.dateOfBirth);
                if (!isNaN(d)) row.dateOfBirthArray = [d.toISOString().slice(0,10)];
                else row.dateOfBirthArray = [];
            } else row.dateOfBirthArray = [];

            // --- Addresses ---
            if (row["Address Country"]) {
                const countryKey = String(row["Address Country"]).toLowerCase();
                const iso = countryMap[countryKey] || null;
                row.addresses = iso ? [{ countryCode: iso }] : [];
                row.citizenshipCode = iso ? [iso] : [];
                row.residentOfCode = iso ? [iso] : [];
                row.countryOfRegistrationCode = iso ? [iso] : [];
            } else {
                row.addresses = [];
                row.citizenshipCode = [];
                row.residentOfCode = [];
                row.countryOfRegistrationCode = [];
            }

            // --- Lists block ---
            const ref = row.list_reference_details || "";
            const parentId = "TRAE-Import-File";
            const parentName = "TRAE Import File";
            const lists = [{
                active: true,
                hierarchy: [{id: parentId, name: parentName}],
                id: parentId,
                listActive: true,
                name: parentName
            }];
            if (ref && ref.toLowerCase() !== "nan") {
                const refs = ref.split('|').map(r => r.trim()).filter(r => r);
                refs.forEach(rname => {
                    const dynamicId = rname.toUpperCase().replace(/[\s\[\]\/:]/g, '-');
                    lists.push({
                        active: true,
                        hierarchy: [
                            {id: parentId, name: parentName},
                            {id: dynamicId, name: rname, parent: parentId}
                        ],
                        id: dynamicId,
                        listActive: true,
                        name: rname
                    });
                });
            }
            row.lists = lists;

            row.activeStatus = "Active";

            // --- Clean original columns ---
            delete row["Address Line"];
            delete row["Address City"];
            delete row["Address County"];
            delete row["Address State"];
            delete row["Address Country"];
            delete row["Address Zip"];
            delete row.dateOfBirth;
            delete row.list_reference_details;

            // --- Conditional key omission ---
            if (row.type === "company") {
                delete row.citizenshipCode;
                delete row.residentOfCode;
                delete row.dateOfBirthArray;
            } else if (row.type === "person") {
                delete row.countryOfRegistrationCode;
            }

            return row;
        });

        // ----- Download JSONL -----
        const jsonl = json.map(r => JSON.stringify(r)).join("\n");
        const blob = new Blob([jsonl], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "output.jsonl";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        message.style.color = "green";
        message.textContent = "✅ Conversion complete! JSONL file downloaded.";
    };

    reader.readAsArrayBuffer(fileInput.files[0]);
});
