/*******************************************************************
 * Match Admin System: Web App - Frontend & Data Services
 * 
 * Responsible for all logic related to serving the web application
 * and its data, including the main doGet() and all cached data-
 * getter functions called by the UI.
 *******************************************************************/
//==============================================================
// 1️⃣ WEB APP - FRONTEND & DATA SERVICES
//==============================================================

/**
 * Serves the main web app (index.html).
 * V2: Now reads the 'Enable Away Booking' setting and passes it to the template.
 * Also has secret backdoor.
 */
function doGet(e) {
  // Every time the web app is loaded, have it save its own URL to the script's memory.
  try {
    PropertiesService.getScriptProperties().setProperty('LAST_KNOWN_URL', ScriptApp.getService().getUrl());
  } catch(propError) {
    Logger.log(`Minor error: Could not save web app URL to properties. ${propError.message}`);
  }

  // This block is REQUIRED to make your "?action=clear" work.
  if (e && e.parameter && e.parameter.action === 'clear') {
    try {
      const keysToClear = [
        'CLUB_SETTINGS', 'OUR_TEAMS', 'SEASON_MONTHS', 
        'OPPONENT_CLUBS', 'PENDING_FIXTURES', 'PENDING_AWAY_FIXTURES'
      ];
      CacheService.getScriptCache().removeAll(keysToClear);
      return ContentService.createTextOutput("SUCCESS: The web application cache has been cleared. You can now close this tab.");
    } catch (err) {
      return ContentService.createTextOutput(`ERROR: Could not clear cache. ${err.message}`);
    }
  }

  const settings = getClubSettings();
  const template = HtmlService.createTemplateFromFile('index');
  template.clubName = settings['Club Name'] || 'Match Booking Portal';
  template.email = settings['Match Secretary Email'] || '';
  
  // This line correctly passes the variable to the frontend.
  const enableAway = String(settings['Enable Away Booking'] || '').trim().toUpperCase();
  template.awayBookingEnabled = (enableAway === 'TRUE');
  
  return template.evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}

/**
 * Gets all key/value pairs from the 'Settings' sheet.
 * Caches the result for 30 mins to improve web app performance.
 * @returns {Object} An object of the settings.
 */
function getClubSettings() {
  const cacheKey = 'CLUB_SETTINGS';
  const fetchFunction = getClubSettings_;
  return getCachedData(cacheKey, fetchFunction, 1800); // 30 min cache
}

// --- Internal "fetch" function for settings ---
function getClubSettings_() {
  const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.SETTINGS);
  const lastRow = settingsSheet.getLastRow();

  if (lastRow < 2) {
    Logger.log("getClubSettings_: 'Settings' sheet is empty or has no data.");
    return {};
  }

  // Use .getDisplayValues() to get formatted text ("20:00") instead of raw Date objects
  const data = settingsSheet.getRange(2, 1, settingsSheet.getLastRow() - 1, 2).getDisplayValues();

  const settings = {};
  for (const row of data) {
    if (row[0]) {
      settings[row[0]] = row[1];
    }
  }
  return settings;
}

/**
 * Public function to get the list of "Our Teams" for the web app.
 * Caches for 1 hour.
 */
function getOurTeams() {
  return getCachedData('OUR_TEAMS', getOurTeams_, 3600);
}

// --- Internal "fetch" function for our teams ---
function getOurTeams_() {
  try {
    const teamsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.TEAMS);
    const lastRow = teamsSheet.getLastRow();

    if (lastRow < 2) {
      Logger.log("getOurTeams_: 'Teams' sheet is empty or has no data.");
      return [];
    }

    const data = teamsSheet.getRange(2, 1, teamsSheet.getLastRow() - 1, 2).getValues();

    const teams = [];
    for (const row of data) {
      if (row[0] && row[1]) { // If Division (col A) and Team (col B) exist
        teams.push({
          division: "Div " + row[0], // "Div 1"
          name: row[1] // "L1"
        });
      }
    }
    teams.sort((a, b) => a.name.localeCompare(b.name));
    return teams;

  } catch (e) {
    Logger.log(`Error in getOurTeams_: ${e.message}\nStack: ${e.stack}`);
    throw new Error("Could not load team list from 'Teams' sheet.");
  }
}

/**
 * Public function to get valid season months for the web app.
 * Caches for 1 hour.
 */
function getValidSeasonMonths() {
  return getCachedData('SEASON_MONTHS', getValidSeasonMonths_, 3600);
}

/**
 * [HELPER] Gets valid season months, filtering out any past months.
 * This is the internal "fetch" function.
 */
function getValidSeasonMonths_() {
  try {
    const availabilitySheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.AVAILABILITY);
    if (availabilitySheet.getLastRow() < 2) {
      Logger.log("getValidSeasonMonths_: 'Availability' sheet is empty or has no data.");
      return [];
    }

    // Get today's date at midnight for accurate comparison ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates = availabilitySheet.getRange(2, 1, availabilitySheet.getLastRow() - 1, 1).getValues();
    const monthSet = new Set();
    const monthList = [];
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

    for (let i = 0; i < dates.length; i++) {
      if (dates[i][0]) {
        try {
          const date = new Date(dates[i][0]);
          if (isNaN(date.getTime())) continue;

          // Only process the date if it is today or in the future ---
          if (date >= today) {
            const year = date.getFullYear();
            const monthIndex = date.getMonth();
            const monthKey = `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
            if (!monthSet.has(monthKey)) {
              monthSet.add(monthKey);
              monthList.push({
                value: monthKey,
                name: `${monthNames[monthIndex]} ${year}`
              });
            }
          }

        } catch (e) { /* ignore invalid dates */ }
      }
    }
    monthList.sort((a, b) => a.value.localeCompare(b.value));
    return monthList;
  } catch (e) {
    Logger.log(`Error in getValidSeasonMonths_: ${e.message}\nStack: ${e.stack}`);
    throw new Error("Could not load season months from 'Availability' sheet.");
  }
}

/**
 * Public function to get opponent clubs for the web app.
 * Caches for 1 hour.
 */
function getOpponentClubs() {
  return getCachedData('OPPONENT_CLUBS', getOpponentClubs_, 3600);
}

// --- Internal "fetch" function for opponent clubs ---
function getOpponentClubs_() {
  try {
    const oppSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.OPPONENTS);
    const lastRow = oppSheet.getLastRow();

    if (lastRow < 2) {
      Logger.log("getOpponentClubs_: 'Opponent Info' sheet is empty or has no data.");
      return [];
    }

    const data = oppSheet.getRange(2, 1, oppSheet.getLastRow() - 1, 6).getValues();

    const clubList = [];
    const clubSet = new Set();

    for (const row of data) {
      const clubName = row[0];
      const clubEmail = row[5]; // Column F
      if (clubName && !clubSet.has(clubName)) {
        clubSet.add(clubName);
        clubList.push({ name: clubName, email: clubEmail || "" });
      }
    }

    clubList.sort((a, b) => a.name.localeCompare(b.name));
    return clubList;
  } catch (e) {
    Logger.log(`Error in getOpponentClubs_: ${e.message}\nStack: ${e.stack}`);
    throw new Error("Could not load opponent clubs from 'Opponent Info' sheet.");
  }
}

/**
 * Public function to get pending home fixtures for the web app.
 * Caches for 1 hour.
 */
/**
 * Public function to get pending home fixtures for the web app.
 * NO LONGER CACHED (Real-time).
 */
function getPendingHomeFixtures() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fixturesSheet = ss.getSheetByName(CONFIG.SHEETS.FIXTURES);
  if (!fixturesSheet) {
    Logger.log("getPendingHomeFixtures: 'Fixtures' sheet not found.");
    return {};
  }

  const fixturesData = fixturesSheet.getDataRange().getValues();
  const h = findFixtureHeaders(fixturesData); // Use helper
  if (!h) {
    Logger.log("getPendingHomeFixtures: Could not find all required headers in 'Fixtures' sheet.");
    return {};
  }

  const fixtureMap = {};

  for (let i = h.headerRowIndex + 1; i < fixturesData.length; i++) {
    const row = fixturesData[i];

    const ourTeam = row[h['Team No.']];
    const homeAway = row[h['Home / Away']];
    const status = row[h['Match Status']];
    const oppClub = row[h['Opposition Club']];
    const oppTeam = row[h['Opp Team No.']];
    const matchType = row[h['League / Cup']];

    if (!ourTeam && !oppClub) continue; // Skip empty rows

    if (ourTeam && homeAway === 'Home' && status === 'Not confirmed') {
      const opponent = { club: oppClub, team: oppTeam, type: matchType };
      if (!fixtureMap[ourTeam]) {
        fixtureMap[ourTeam] = [opponent];
      } else {
        const exists = fixtureMap[ourTeam].some(item =>
          item.club === opponent.club &&
          item.team === opponent.team &&
          item.type === opponent.type
        );
        if (!exists) {
          fixtureMap[ourTeam].push(opponent);
        }
      }
    }
  }
  Logger.log(`Built pending fixture map: ${Object.keys(fixtureMap).length} teams found.`);
  return fixtureMap;
}

/**
 * Public function for the web app to get pending AWAY fixtures.
 * Caches for 1 hour.
 */
/**
 * Public function for the web app to get pending AWAY fixtures.
 * NO LONGER CACHED (Real-time).
 * This is used to populate the opponent dropdown in the away booking flow.
 * @returns {Object} A map of pending away fixtures.
 */
function getPendingAwayFixtures() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fixturesSheet = ss.getSheetByName(CONFIG.SHEETS.FIXTURES);
  if (!fixturesSheet) {
    Logger.log("getPendingAwayFixtures: 'Fixtures' sheet not found.");
    return {};
  }

  const fixturesData = fixturesSheet.getDataRange().getValues();
  const h = findFixtureHeaders(fixturesData);

  if (!h) {
    Logger.log("getPendingAwayFixtures_: Could not find all required headers in 'Fixtures' sheet.");
    return {};
  }

  const fixtureMap = {};

  for (let i = h.headerRowIndex + 1; i < fixturesData.length; i++) {
    const row = fixturesData[i];

    const yourClubName = row[h['Your Club']];
    const ourTeam = row[h['Team No.']];
    const homeAway = row[h['Home / Away']];
    const status = row[h['Match Status']];

    if (yourClubName !== getClubSettings()['Club Name'] || homeAway !== 'Away' || status !== 'Not confirmed') {
      continue;
    }
    
    const oppClub = row[h['Opposition Club']];
    const oppTeam = row[h['Opp Team No.']];
    const matchType = row[h['League / Cup']];
    
    if (!ourTeam || !oppClub) continue;

    const opponent = { 
      club: oppClub, 
      team: oppTeam, 
      type: matchType 
    };

    if (!fixtureMap[ourTeam]) {
      fixtureMap[ourTeam] = [opponent];
    } else {
      const exists = fixtureMap[ourTeam].some(item =>
        item.club === opponent.club && 
        item.team === opponent.team && 
        item.type === opponent.type
      );
      if (!exists) {
        fixtureMap[ourTeam].push(opponent);
      }
    }
  }

  Logger.log(`Built pending AWAY fixture map: ${Object.keys(fixtureMap).length} of our teams found.`);
  return fixtureMap;
}

/**
 * Gets the available time slots for a given date, based on 'Settings'.
 * This function is simple and does not need caching.
 * UPDATED: Now uses the _getDaySettingKey helper.
 */
function getTimeSlotsForDate(dateStr) {
  try {
    const settings = getClubSettings();
    const dateObj = parseDMY(dateStr);
    const dayOfWeek = dateObj.getDay();

    // Use the new, centralized helper function
    const timeSlotKey = _getDaySettingKey(dayOfWeek, 'Time Slot');
    const timeString = settings[timeSlotKey] || ""; // Get e.g. "19:00, 20:00"

    if (!timeString) {
      return []; // No times defined for this day
    }

    return timeString.split(',').map(time => time.trim());

  } catch (e) {
    Logger.log(`Error in getTimeSlotsForDate: ${e.message}\nStack: ${e.stack}`);
    return []; // Return empty array on failure
  }
}