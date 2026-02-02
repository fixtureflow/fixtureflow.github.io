/*******************************************************************
 * Captain's Dashboard Logic
 *
 * Contains logic for fetching and formatting data for the 
 * read-only Captain's Dashboard.
 *******************************************************************/

/**
 * [CORE] Fetches dashboard data: Upcoming Matches & Player Availability.
 * 
 * @param {string} pin The PIN provided by the user.
 * @param {Object} settings Dependency injection for settings.
 * @returns {Object} JSON object with structure { success: boolean, ... }
 */
function getCaptainDashboardData_(pin, settings) {
  // 1. PIN Verification
  const storedPin = String(settings[CONFIG.SETTINGS_KEYS.CAPTAIN_PIN] || '').trim();
  const providedPin = String(pin || '').trim();

  // If a PIN is configured, enforce it.
  // If no PIN is configured, we treat it as "Open Access" (or could default to block, but let's be flexible).
  if (storedPin && storedPin !== providedPin) {
    return { 
      success: false, 
      error: 'Authorization Failed: Invalid PIN.' 
    };
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const timeZone = Session.getScriptTimeZone();
  
  // 2. Define Date Range (Today -> +35 Days (~5 weeks))
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const futureDate = new Date(today);
  futureDate.setDate(today.getDate() + 35); 
  
  // 3. Fetch Data
  const matches = _getDashboardFixtures(ss, today, futureDate, timeZone);
  const availability = _getDashboardAvailability(ss, today, futureDate, timeZone);
  
  // 4. Return Structure
  return {
    success: true,
    data: {
      fixtures: matches,
      availability: availability,
      generatedAt: Utilities.formatDate(new Date(), timeZone, "yyyy-MM-dd HH:mm:ss")
    }
  };
}

/**
 * [HELPER] Get confirmed matches for the date range.
 * @returns {Object[]} Array of match objects.
 */
function _getDashboardFixtures(ss, startDate, endDate, timeZone) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.FIXTURES);
  if (!sheet) return [];
  
  const data = sheet.getDataRange().getValues();
  const h = findFixtureHeaders(data);
  if (!h) return [];
  
  const fixtures = [];
  
  for (let i = h.headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    const status = row[h[CONFIG.HEADERS.FIXTURE_STATUS]];
    
    // Only show Confirmed matches
    if (status !== CONFIG.STATUSES.CONFIRMED) continue;
    
    const dateVal = row[h[CONFIG.HEADERS.FIXTURE_DATE]];
    if (!dateVal || !(dateVal instanceof Date)) continue;
    
    // Date Filter (Inclusive)
    if (dateVal < startDate || dateVal > endDate) continue;
    
    fixtures.push({
      date: Utilities.formatDate(dateVal, timeZone, 'yyyy-MM-dd'),
      displayDate: Utilities.formatDate(dateVal, timeZone, 'EEE, d MMM'),
      time: row[h[CONFIG.HEADERS.FIXTURE_TIME]] ? Utilities.formatDate(new Date(row[h[CONFIG.HEADERS.FIXTURE_TIME]]), timeZone, 'HH:mm') : 'TBC',
      ourTeam: String(row[h[CONFIG.HEADERS.FIXTURE_OUR_TEAM]] || ''),
      opponent: `${row[h[CONFIG.HEADERS.FIXTURE_OPP_CLUB]]} - ${row[h[CONFIG.HEADERS.FIXTURE_OPP_TEAM]]}`,
      venue: row[h[CONFIG.HEADERS.FIXTURE_VENUE]],
      homeAway: row[h[CONFIG.HEADERS.FIXTURE_HOME_AWAY]],
      leagueCup: row[h[CONFIG.HEADERS.FIXTURE_LEAGUE_CUP]]
    });
  }
  
  // Sort by Date
  fixtures.sort((a, b) => new Date(a.date) - new Date(b.date));
  return fixtures;
}

/**
 * [HELPER] Get availability map for the date range.
 * Returns a sparse map to minimize payload size.
 * Structure: { "yyyy-MM-dd": { "PlayerName": "U" (or X/R) } }
 */
function _getDashboardAvailability(ss, startDate, endDate, timeZone) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.AVAILABILITY);
  if (!sheet) return {};
  
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return {}; // No data

  const headers = data[0];
  
  // Map relevant player columns
  // We assume all columns after index 0 are players or metadata.
  const playerMap = {};
  for (let c = 1; c < headers.length; c++) {
    const val = String(headers[c]).trim();
    // Skip empty headers or specific metadata strings if known (e.g. "Admin Lock")
    // "Admin Lock" IS a player column effectively in this system, 
    // but maybe we want to hide it? Or show it as "Details"?
    // The Dashboard needs to know if a date is locked.
    if (val) playerMap[c] = val;
  }
  
  const availMap = {};
  
  for (let r = 1; r < data.length; r++) {
    const dateVal = data[r][0];
    if (!dateVal || !(dateVal instanceof Date)) continue;
    
    // Date Filter
    if (dateVal < startDate || dateVal > endDate) continue;
    
    const dateKey = Utilities.formatDate(dateVal, timeZone, 'yyyy-MM-dd');
    const rowMap = {};
    let hasData = false;
    
    for (const c in playerMap) {
      const val = String(data[r][c]).trim().toUpperCase();
      // Only include significant values: U (Unavailable), X (Match), R (Rest/Reserve), L (Lock?)
      if (val === 'U' || val === 'X' || val === 'R' || (val && playerMap[c] === CONFIG.HEADERS.ADMIN_LOCK)) {
        rowMap[playerMap[c]] = val;
        hasData = true;
      }
    }
    
    if (hasData) {
      availMap[dateKey] = rowMap;
    }
  }
  
  return availMap;
}
