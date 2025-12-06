// script.js

const fileInput = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const downloadLink = document.getElementById('downloadLink');
const outputPre = document.getElementById('output');

const progressBar = document.createElement('div');
progressBar.id = "progress-bar";
progressBar.style.width = "0%";
progressBar.style.height = "20px";
progressBar.style.background = "#4caf50";
progressBar.style.marginTop = "10px";
fileInput.parentNode.insertBefore(progressBar, convertBtn);

// --- Country name mapping (Python fix included)
const country_name_map = {
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

// --- Column mappings like Python
const MAPPINGS = {
    "PersonentityID": "profileId",
    "Record Type": "type",
    "Action Type": "action",
    "Gender": "gender",
    "Deceased": "deceased",
    "Primary Name": "name",
    "TAE Profile Notes": "profileNotes",
    "Date of Birth": "dateOfBirth",
    "List Reference Details": "list_reference_details",
    "Address Line": "line1",
    "Address City": "city",
    "Address County": "province",
    "Address State": "state",
    "Address Country": "countryCode",
    "Address Zip": "poBox"
};

// --- Convert country name to ISO alpha-2 code
function countryToISO(country){
    if(!country) return null;
    const cstr = country.toString().trim();
    const lookup = country_name_map[cstr.toLowerCase()] || cstr;
    // Simple prebuilt list for demo (replace with real ISO lookup if needed)
    try {
        // Using Intl API for ISO 3166-1 alpha-2
        return new Intl.DisplayNames(['en'], {type: 'region'}).of(lookup) || lookup;
    } catch(e){
        return lookup;
    }
}

// --- Rename columns like Python
function renameColumns(row){
    const newRow = {};
    for(let key in row){
        const newKey = MAPPINGS[key] || key;
        newRow[newKey] = row[key];
    }
    return newRow;
}

// --- Build addresses
function buildAddress(row){
    const iso = countryToISO(row.countryCode);
    if(!iso) return [];
    const addr = { countryCode: iso };
    if(row.line1) addr.line = row.line1.toString().trim();
    if(row.city) addr.city = row.city.toString().trim();
    if(row.state) addr.province = row.state.toString().trim();
    return [addr];
}

// --- Build lists
function buildLists(row){
    const parent_id = "TRAE-Import-File";
    const parent_name = "TRAE Import File";
    const final_lists = [{
        active: true,
        hierarchy: [{id: parent_id, name: parent_name}],
        id: parent_id,
        listActive: true,
        name: parent_name
    }];
    const ref_raw = row.list_reference_details || "";
    if(!ref_raw || ref_raw.toString().toLowerCase() === "nan") return final_lists;
    const refs = ref_raw.toString().split('|').map(r=>r.trim()).filter(r=>r!=="");
    refs.forEach(r=>{
        const dyn_id = r.toUpperCase().replace(/[\[\]\/: ]/g,"-");
        final_lists.push({
            active:true,
            hierarchy:[
                {id: parent_id, name: parent_name},
                {id: dyn_id, name: r, parent: parent_id}
            ],
            id: dyn_id,
            listActive:true,
            name: r
        });
    });
    return final_lists;
}

// --- Convert date to ISO
function formatDate(date){
    if(!date) return [];
    const d = new Date(date);
    if(isNaN(d)) return [];
    return [d.toISOString().split("T")[0]];
}

// --- Key omission logic like Python
function cleanRecord(record){
    const type = record.type;
    const keys = Object.keys(record);
    keys.forEach(k=>{
        const val = record[k];
        if(val === undefined || val === null || (Array.isArray(val) && val.length===0) || (typeof val==='string' && val.trim()==="")){
            if(!["citizenshipCode","residentOfCode","countryOfRegistrationCode"].includes(k)){
                delete record[k];
            }
        }
    });
    if(type==="company"){
        delete record.citizenshipCode;
        delete record.residentOfCode;
        delete record.dateOfBirthArray;
    } else if(type==="person"){
        delete record.countryOfRegistrationCode;
    }
    return record;
}

// --- Handle conversion
convertBtn.addEventListener('click',()=>{
    const file = fileInput.files[0];
    if(!file){
        alert("Please upload a file first!");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e){
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, {type:'array'});
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        let jsonData = XLSX.utils.sheet_to_json(firstSheet, {defval:""});
        
        // --- Rename columns
        jsonData = jsonData.map(renameColumns);
        
        const total = jsonData.length;
        const outputLines = [];
        
        jsonData.forEach((row, idx)=>{
            // Profile ID prefix
            if(row.profileId) row.profileId = "TRAE"+row.profileId.toString().trim();
            // Type conversion
            if(row.type){
                const t=row.type.toString().toLowerCase().trim();
                row.type = t==="entity"?"company": t==="person"?"person": t;
            }
            // Always active
            row.activeStatus="Active";
            // Dates
            row.dateOfBirthArray = formatDate(row.dateOfBirth);
            // Addresses
            row.addresses = buildAddress(row);
            // Country codes
            row.citizenshipCode = row.countryCode?[row.countryCode]:[];
            row.residentOfCode = row.countryCode?[row.countryCode]:[];
            row.countryOfRegistrationCode = row.countryCode?[row.countryCode]:[];
            // Lists
            row.lists = buildLists(row);
            // Clean row
            const clean = cleanRecord(row);
            outputLines.push(JSON.stringify(clean));
            
            // Update progress bar
            progressBar.style.width = `${Math.floor(((idx+1)/total)*100)}%`;
        });
        
        // --- Prepare download
        const blob = new Blob([outputLines.join('\n')], {type:'text/plain'});
        const url = URL.createObjectURL(blob);
        downloadLink.href = url;
        downloadLink.download = "output.jsonl";
        downloadLink.style.display = "inline-block";
        downloadLink.textContent = "Download JSONL";
        outputPre.textContent = "Conversion completed! " + total + " records processed.";
        alert("Conversion completed!");
    };
    reader.readAsArrayBuffer(file);
});
