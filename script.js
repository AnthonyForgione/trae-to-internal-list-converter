document.getElementById("convertBtn").addEventListener("click", () => {
    const fileInput = document.getElementById("fileInput");
    const message = document.getElementById("message");
    const progressContainer = document.querySelector(".progress-container");
    const progressBar = document.getElementById("progressBar");
    message.textContent = "";

    if (!fileInput.files.length) {
        message.style.color = "red";
        message.textContent = "Please select an Excel file to convert.";
        return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: "" });

        progressContainer.style.display = "block";

        // Simple chunked processing
        let i = 0, chunk = 100;
        function processChunk() {
            const end = Math.min(i + chunk, json.length);
            for (let j = i; j < end; j++) {
                const row = json[j];
                // Minimal example: rename columns if they exist
                if (row.PersonentityID) row.profileId = "TRAE" + row.PersonentityID;
                if (row["Record Type"]) row.type = row["Record Type"].toLowerCase() === "entity" ? "company" : "person";
                row.activeStatus = "Active";
            }
            i = end;
            const percent = Math.floor((i / json.length) * 100);
            progressBar.style.width = percent + "%";
            progressBar.textContent = percent + "%";

            if (i < json.length) setTimeout(processChunk, 10);
            else downloadJSONL(json);
        }
        processChunk();
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
});

function downloadJSONL(json) {
    const blob = new Blob(json.map(r => JSON.stringify(r)).join("\n"), { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "output.jsonl";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    document.getElementById("message").style.color = "green";
    document.getElementById("message").textContent = "✅ Conversion complete! JSONL file downloaded.";
    document.querySelector(".progress-container").style.display = "none";
}
