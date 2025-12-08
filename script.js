(function () {
    console.log("TRAE XLS Converter: Script initialized.");

    // ISO Country Helper using the i18n library
    function _to_iso_country(value) {
        if (!value) return null;
        const input = String(value).trim();
        if (input.length === 2) return input.toUpperCase();
        
        try {
            // Attempt conversion using the global 'countries' object from the index.html library
            const code = countries.getAlpha2Code(input, 'en');
            return code || input.substring(0, 2).toUpperCase();
        } catch (e) {
            console.warn("ISO Country conversion error:", e);
            return input.substring(0, 2).toUpperCase();
        }
    }

    function init() {
        const fileInput = document.getElementById('fileInput');
        const convertBtn = document.getElementById('convertBtn');
        const progressText = document.getElementById('progressText');
        const downloadLink = document.getElementById('downloadLink');

        if (!fileInput || !convertBtn) {
            console.error("Critical Error: Required HTML elements not found!");
            return;
        }

        // 1. Enable button logic
        fileInput.addEventListener('change', (e) => {
            console.log("File selected:", e.target.files[0].name);
            if (e.target.files.length > 0) {
                convertBtn.disabled = false;
                progressText.textContent = "File ready: " + e.target.files[0].name;
                progressText.style.color = "#28a745";
            } else {
                convertBtn.disabled = true;
                progressText.textContent = "No file selected.";
            }
        });

        // 2. Conversion logic
        convertBtn.addEventListener('click', () => {
            const file = fileInput.files[0];
            const reader = new FileReader();

            progressText.textContent = "Processing... please wait.";
            
            reader.onload = function (e) {
                try {
                    const data = e.target.result;
                    const workbook = XLSX.read(data, { type: 'array', cellDates: true });
                    const sheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

                    console.log("SheetJS read success. Rows count:", rows.length);

                    const transformed = rows.map(row => {
                        // Cleanup Excel keys
                        const clean = {};
                        Object.keys(row).forEach(k => clean[k.replace(/^"+|"+$/g, '').trim()] = row[k]);

                        return {
                            objectType: 'client',
                            clientId: clean['clientId'],
                            companyName: clean['name'],
                            entityType: clean['entityType'] || 'ORGANISATION',
                            incorporationCountryCode: _to_iso_country(clean['incorporationCountryCode'] || clean['countryCode']),
                            // Map addresses according to your internal list requirement
                            addresses: clean['country'] ? [{
                                countryCode: _to_iso_country(clean['country']),
                                city: clean['city'],
                                line1: clean['Address line1']
                            }] : []
                        };
                    });

                    const jsonl = transformed.map(line => JSON.stringify(line)).join('\n');
                    const blob = new Blob([jsonl], { type: 'application/json' });
                    
                    downloadLink.href = URL.createObjectURL(blob);
                    downloadLink.download = `ISO_Feed_${Date.now()}.jsonl`;
                    downloadLink.style.display = 'inline-block';
                    downloadLink.textContent = "Download Processed JSONL";
                    
                    progressText.textContent = "Conversion Complete!";
                } catch (err) {
                    console.error("Conversion failed:", err);
                    progressText.textContent = "Error during conversion. Check console.";
                }
            };

            reader.readAsArrayBuffer(file);
        });
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
