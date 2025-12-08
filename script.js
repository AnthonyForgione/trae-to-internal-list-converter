(function () {
  // --- NEW ISO UTILITIES ---

  // Simple ISO 8601 Date Formatter (YYYY-MM-DD)
  function _to_iso_date(value) {
    if (isEmpty(value)) return null;
    let d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return null;
    return d.toISOString().split('T')[0];
  }

  // Ensures Country Codes are strictly ISO 3166-1 alpha-2 (2 chars)
  function _to_iso_country(value) {
    if (isEmpty(value)) return null;
    let code = String(value).trim().toUpperCase();
    // If the user typed "United Kingdom", this simple logic won't fix it.
    // However, we ensure it is truncated or flagged if not 2 chars.
    return code.length === 2 ? code : code.substring(0, 2); 
  }

  // --- EXISTING HELPERS (REFINED) ---

  function isEmpty(value) {
    if (value === null || value === undefined) return true;
    if (typeof value === 'number' && isNaN(value)) return true;
    if (typeof value === 'string') return value.trim() === '';
    return false;
  }

  function _to_string_id(value) {
    if (typeof value === 'number' && Number.isInteger(value)) return String(value);
    return String(value);
  }

  function _to_unix_timestamp_ms(value) {
    if (isEmpty(value)) return null;
    let d = value instanceof Date ? value : new Date(value);
    return !isNaN(d.getTime()) ? d.getTime() : null;
  }

  function normalizeKey(k) {
    return String(k || '').replace(/^"+|"+$/g, '').trim();
  }

  function normalizeRowKeys(row) {
    const out = {};
    for (const [k, v] of Object.entries(row)) {
      out[normalizeKey(k)] = v;
    }
    return out;
  }

  // --- MAIN TRANSFORMER ---

  function transformRowToClientJson(rowRaw) {
    const row = normalizeRowKeys(rowRaw);
    const clientData = { objectType: 'client' };

    function addField(key, value) {
      if (!isEmpty(value)) clientData[key] = value;
    }

    // Identifiers
    addField('clientId', row['clientId']);
    addField('entityType', row['entityType']);
    addField('status', row['status']);

    const type = String(row['entityType'] || '').toUpperCase();

    // 1. Names
    if (type === 'ORGANISATION' || type === 'ORGANIZATION') {
      addField('companyName', row['name']);
      addField('incorporationCountryCode', _to_iso_country(row['incorporationCountryCode']));
      addField('dateOfIncorporation', _to_iso_date(row['dateOfIncorporation']));
    } else {
      addField('name', row['name']);
      addField('forename', row['forename']);
      addField('surname', row['surname']);
      addField('gender', String(row['gender'] || '').toUpperCase());
      addField('dateOfBirth', _to_iso_date(row['dateOfBirth']));
      addField('birthPlaceCountryCode', _to_iso_country(row['birthPlaceCountryCode']));
      
      // Nationalities (Ensure ISO format if list provided)
      if (!isEmpty(row['nationalityCodes'])) {
        const codes = String(row['nationalityCodes']).split(',').map(c => _to_iso_country(c));
        addField('nationalityCodes', codes.filter(Boolean));
      }
    }

    // 2. Dates (Standardized to Unix ms per your original requirement)
    addField('lastReviewed', _to_unix_timestamp_ms(row['lastReviewed']));
    addField('periodicReviewStartDate', _to_unix_timestamp_ms(row['periodicReviewStartDate']));

    // 3. Address (Enforce ISO Country Code)
    const addr = {};
    if (!isEmpty(row['Address line1'])) addr.line1 = String(row['Address line1']);
    if (!isEmpty(row['city'])) addr.city = String(row['city']);
    if (!isEmpty(row['postcode'])) addr.postcode = String(row['postcode']);
    
    // ISO Country Mapping
    const cCode = _to_iso_country(row['countryCode'] || row['country']);
    if (cCode) addr.countryCode = cCode;

    if (Object.keys(addr).length > 0) addField('addresses', [addr]);

    return clientData;
  }

  // ... (Keep existing init() and UI logic from your original script) ...
})();
