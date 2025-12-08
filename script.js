(function () {
    // 1. REGISTER ISO DATA (Prevents the ReferenceError)
    // The library loads into the global variable 'countries'
    if (typeof countries !== 'undefined') {
        // We register English data manually since we are using a CDN
        countries.registerLocale(require("i18n-iso-countries/langs/en.json")); 
    }

    /**
     * ISO Helper: Converts names to Alpha-2
     */
    function _to_iso_country(value) {
        if (!value) return null;
        const input = String(value).trim();
        
        // Return immediately if already ISO code
        if (input.length === 2) return input.toUpperCase();

        try {
            // Attempt conversion using library
            const code = countries.getAlpha2Code(input, 'en');
            return code || input.substring(0, 2).toUpperCase();
        } catch (e) {
            return input.substring(0, 2).toUpperCase();
        }
    }

    function init() {
        const fileInput = document.getElementById('fileInput');
        const convertBtn = document.getElementById('convertBtn');
        const progressText = document.getElementById('progressText');
        const downloadLink = document.getElementById('downloadLink');

        // ENABLE BUTTON WHEN FILE PICKED
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                convertBtn.disabled = false;
                progressText.textContent = "Selected: " + e.target.files[0].name;
            } else {
                convertBtn.disabled = true;
            }
        });

        // CONVERSION LOGIC
        convertBtn.addEventListener('click', () => {
            const file = fileInput.files[0];
            const reader = new FileReader();

            progressText.textContent = "Converting...";

            reader.onload = function (e) {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

                    const transformed = rows.map(row => {
                        // Normalize header keys
                        const clean = {};
                        Object.keys(row).forEach(k => clean[k.replace(/^"+|"+$/g, '').trim()] = row[k]);

                        return {
                            objectType: 'client',
                            clientId: clean['clientId'],
                            name: clean['name'],
                            incorporationCountryCode: _to_iso_country(clean['incorporationCountryCode']),
                            addresses: clean['country'] ? [{
                                countryCode: _to_iso_country(clean['country']),
                                city: clean['city']
                            }] : []
                        };
                    });

                    const jsonl = transformed.map(line => JSON.stringify(line)).join('\n');
                    const blob = new Blob([jsonl], { type: 'application/json' });
                    
                    downloadLink.href = URL.createObjectURL(blob);
                    downloadLink.download = `ISO_Converted_${Date.now()}.jsonl`;
                    downloadLink.style.display = 'inline-block';
                    downloadLink.textContent = "Download Processed JSONL";
                    
                    progressText.textContent = "Success!";
                } catch (err) {
                    console.error(err);
                    progressText.textContent = "Error during conversion.";
                }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
