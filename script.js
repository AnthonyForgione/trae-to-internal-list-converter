// Country map for special cases
const country_name_map = {
    "russia": "Russian Federation", "united states": "United States",
    "united kingdom": "United Kingdom", "iran": "Iran, Islamic Republic of",
    "korea, north": "Korea, Democratic People's Republic of",
    "korea, south": "Korea, Republic of", "palestine": "Palestine, State of",
    "vietnam": "Viet Nam", "syria": "Syrian Arab Republic",
    "tanzania": "Tanzania, United Republic of", "venezuela": "Venezuela, Bolivarian Republic of",
    "turkey": "Türkiye",
    "democratic republic of the congo": "Congo, The Democratic Republic of the",
    "congo republic": "Congo",
    "macau": "Macao, S.A.R., China"
};

// Convert country name to ISO alpha-2
function country_to_iso(name) {
    if (!name) return null;
    const lookup = country_name_map[name.toLowerCase()] || name;
    try {
        return Intl.DisplayNames ? new Intl.DisplayNames(['en'], {type:'region'}).of(lookup) : lookup;
    } catch {
        return lookup.slice(0,2).toUpperCase(); // fallback
    }
}

// Build address object
function build_address(row) {
    const iso = country_to_iso(row["Address Country"]);
    if (!iso) return [];
    const addr = { countryCode: iso };
    if (row["Address Line"]) addr.line = row["Address Line"].toString().trim();
    if (row["Address City"]) addr.city = row["Address City"].toString().trim();
    if (row["Address State"]) addr.province = row["Address State"].toString().trim();
    return [addr];
}

// Build lists
function build_lists(row) {
    const parent_id = "TRAE-Import-File";
    const parent_name = "TRAE Import File";
    const final_lists = [{
        active:true,
        hierarchy:[{id:parent_id,name:parent_name}],
        id: parent_id,
        listActive:true,
        name:parent_name
    }];
    let ref = row.list_reference_details;
    if(!ref || ref.toString().toLowerCase() === "nan") return final_lists;
    const refs = ref.toString().split("|").map(r=>r.trim()).filter(Boolean);
    refs.forEach(r=>{
        const dynamic_id = r.toUpperCase().replace(/[\[\]\/: ]/g,"-");
        final_lists.push({
            active:true,
            hierarchy:[{id:parent_id,name:parent_name},{id:dynamic_id,name:r,parent:parent_id}],
            id: dynamic_id,
            listActive:true,
            name:r
        });
    });
    return final_lists;
}

// Main conversion
document.getElementById("convertBtn").addEventListener("click", () => {
    const fileInput = document.getElementById("fileInput");
    const message = document.getElementById("message");
    const progressContainer = document.querySelector(".progress-container");
    const progressBar = document.getElementById("progressBar");
    message.textContent = "";
    if (!fileInput.files.length) {
        message.style.color="red"; message.textContent="Please select a file."; return;
    }
    const reader = new FileReader();
    reader.onload = e => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type:"array"});
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        let df = XLSX.utils.sheet_to_json(sheet, {defval:""});

        progressContainer.style.display="block";
        let i=0, chunk=50;

        function processChunk() {
            const end = Math.min(i+chunk, df.length);
            for(let j=i;j<end;j++){
                let row = df[j];
                if(row.PersonentityID) row.profileId = "TRAE"+row.PersonentityID.toString().trim();
                if(row["Record Type"]) {
                    const t=row["Record Type"].toString().toLowerCase().trim();
                    row.type = t==="entity"?"company": t==="person"?"person": t;
                }
                if(row["Date of Birth"]){
                    const d = new Date(row["Date of Birth"]);
                    if(!isNaN(d)) row.dateOfBirthArray = [d.toISOString().split("T")[0]]; else row.dateOfBirthArray=[];
                } else row.dateOfBirthArray=[];
                row.addresses = build_address(row);
                row.citizenshipCode = row["Address Country"]?[country_to_iso(row["Address Country"])]:[];
                row.residentOfCode = row["Address Country"]?[country_to_iso(row["Address Country"])]:[];
                row.countryOfRegistrationCode = row["Address Country"]?[country_to_iso(row["Address Country"])]:[];
                row.lists = build_lists(row);
                row.activeStatus="Active";
            }
            i=end;
            const percent=Math.floor((i/df.length)*100);
            progressBar.style.width=percent+"%";
            progressBar.textContent=percent+"%";
            if(i<df.length) setTimeout(processChunk,10);
            else finishConversion(df);
        }
        processChunk();
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
});

// Clean and download JSONL
function finishConversion(df){
    const output = [];
    df.forEach(row=>{
        let r = {...row};
        if(r.type==="company"){
            delete r.citizenshipCode; delete r.residentOfCode; delete r.dateOfBirthArray;
        } else if(r.type==="person"){
            delete r.countryOfRegistrationCode;
        }
        Object.keys(r).forEach(k=>{
            const v=r[k];
            if(v===null || v===undefined || (Array.isArray(v)&&v.length===0) || (typeof v==="string" && v.trim()==="")) delete r[k];
        });
        output.push(r);
    });
    const blob = new Blob(output.map(r=>JSON.stringify(r)).join("\n"), {type:"application/json"});
    const link = document.createElement("a");
    link.href=URL.createObjectURL(blob);
    link.download="output.jsonl";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    document.getElementById("message").style.color="green";
    document.getElementById("message").textContent="✅ Conversion complete! JSONL file downloaded.";
    document.querySelector(".progress-container").style.display="none";
}
