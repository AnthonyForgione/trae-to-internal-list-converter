(function () {
  // ISO Utility using the library loaded in index.html
  function _to_iso_country(value) {
    if (isEmpty(value)) return null;
    const input = String(value).trim();
    
    // 1. Check if it's already a 2-letter code
    if (input.length === 2) return input.toUpperCase();

    // 2. Try to convert from name (e.g., "United Kingdom" -> "GB")
    const code = countries.getAlpha2Code(input, 'en');
    return code || input.substring(0, 2).toUpperCase(); // Fallback to first 2 chars
  }

  function isEmpty(value) {
    return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
  }

  function init() {
    const fileInput = document.getElementById('fileInput');
    const convertBtn = document.getElementById('convertBtn');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const downloadLink = document.getElementById('downloadLink');

    // --- FIX: Enable button when file is selected ---
    fileInput.addEventListener('change', () => {
      if (fileInput.files.length > 0) {
        convertBtn.disabled = false;
        convertBtn.classList.add('active'); // Optional: for CSS styling
      } else {
        convertBtn.disabled = true;
      }
    });

    convertBtn.addEventListener('click', () => {
      const file = fileInput.files[0];
      const reader = new FileReader();

      reader.onload = function (e) {
        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { defval: null });

        // Transform with ISO logic
        const transformed = rows.map(row => {
          // Normalize keys (remove quotes/spaces)
          const cleanRow = {};
          Object.keys(row).forEach(k => cleanRow[k.replace(/^"+|"+$/g, '').trim()] = row[k]);

          return {
            objectType: 'client',
            clientId: cleanRow['clientId'],
            companyName: cleanRow['name'],
            // ISO COUNTRY CONVERSION
            incorporationCountryCode: _to_iso_country(cleanRow['incorporationCountryCode']),
            addresses: cleanRow['country'] ? [{
              countryCode: _to_iso_country(cleanRow['countryCode'] || cleanRow['country']),
              city: cleanRow['city']
            }] : []
          };
        });

        // Create Blob for download
        const jsonlContent = transformed.map(line => JSON.stringify(line)).join('\n');
        const blob = new Blob([jsonlContent], { type: 'application/json' });
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.download = `converted_${Date.now()}.jsonl`;
        downloadLink.style.display = 'block';
        downloadLink.textContent = 'Click here to download ISO JSONL';
      };

      reader.readAsArrayBuffer(file);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
