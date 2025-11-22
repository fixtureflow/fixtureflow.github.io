/*******************************************************************
 * Match Admin System: Data Builder Functions
 *
 * This file contains helper functions dedicated to reading spreadsheet
 * data and transforming it into efficient, usable data structures
 * like Objects (maps) and Arrays.
 *******************************************************************/
//==============================================================
// 4️⃣ DATA BUILDERS
//==============================================================

/**
 * [HELPER] Reads the 'Teams' sheet and builds a map of team names to their player lists.
 * This is a highly efficient way to get all team data in one operation.
 * 
 * @param {Spreadsheet} ss The active spreadsheet object.
 * @returns {Object.<string, string[]>} A map where keys are uppercase team names and values are arrays of player names.
 *                                      e.g., { "M1": ["Robbie Frost", "Senan O’Rourke", ...], "L1": ["Leonie Ward", ...] }
 */
function _buildTeamPlayerMap(ss) {
  const teamsSheet = ss.getSheetByName(CONFIG.SHEETS.TEAMS);
  if (!teamsSheet) {
    throw new Error(`The '${CONFIG.SHEETS.TEAMS}' sheet was not found.`);
  }
  // Get all data in one read. Use getDisplayValues() to ensure names are read as strings.
  const teamsData = teamsSheet.getDataRange().getDisplayValues();
  const teamMap = {};

  // Start from row 1 to skip the header row.
  for (let i = 1; i < teamsData.length; i++) {
    const row = teamsData[i];
    const teamName = row[1]; // Team name is in Column B (index 1)
    if (teamName) {
      const players = row.slice(
        CONFIG.TEAM_SHEET.PLAYER_START_COL,
        CONFIG.TEAM_SHEET.PLAYER_END_COL
      ).map(p => p.trim()).filter(p => p);
      teamMap[teamName.trim().toUpperCase()] = players;
    }
  }
  Logger.log(`Built Team Player Map for ${Object.keys(teamMap).length} teams.`);
  return teamMap;
}

/**
 * [HELPER] Reads the 'Availability' sheet and builds lookup maps for dates and players.
 * This is a highly efficient way to avoid searching the grid repeatedly.
 * 
 * @param {Spreadsheet} ss The active spreadsheet object.
 * @returns {{availData: Array<Array<string>>, playerColMap: Object.<string, number>, dateRowMap: Object.<string, number>}}:
 *                   { 
 *                     availData: Array[][], // The entire 2D array of grid data
 *                     playerColMap: Object, // e.g., { "PLAYER A": 3, "PLAYER B": 4 }
 *                     dateRowMap: Object    // e.g., { "2025-10-31": 15, "2025-11-01": 16 }
 *                   }
 */
function _buildAvailabilityGridMaps(ss) {
  const availabilitySheet = ss.getSheetByName(CONFIG.SHEETS.AVAILABILITY);
  if (!availabilitySheet) {
    throw new Error(`The '${CONFIG.SHEETS.AVAILABILITY}' sheet was not found.`);
  }
  
  const availData = availabilitySheet.getDataRange().getDisplayValues();

  // 1. Get the "single source of truth" for all player names from the Teams sheet.
  const allPlayersMap = _buildTeamPlayerMap(ss);
  const allPlayerNames = new Set(Object.values(allPlayersMap).flat());

  // 2. Get the headers from the Availability sheet.
  const availHeaders = availData[0];
  const availHeaderMap = {};
  for (let i = 0; i < availHeaders.length; i++) {
    if (availHeaders[i] && availHeaders[i].trim() !== '') {
      availHeaderMap[availHeaders[i].trim().toUpperCase()] = i;
    }
  }

  // 3. Build the final, correct playerColMap by cross-referencing.
  const playerColMap = {};
  allPlayerNames.forEach(playerName => {
    const upperPlayerName = playerName.trim().toUpperCase();
    if (availHeaderMap.hasOwnProperty(upperPlayerName)) {
      playerColMap[upperPlayerName] = availHeaderMap[upperPlayerName];
    }
  });
  
  if (availHeaderMap.hasOwnProperty('ADMIN_LOCK')) {
      playerColMap['ADMIN_LOCK'] = availHeaderMap['ADMIN_LOCK'];
  }

  const dateRowMap = {};
  for (let i = 1; i < availData.length; i++) {
    try {
      const dateStr = formatDateForSheet(new Date(availData[i][0]));
      if (dateStr) {
        dateRowMap[dateStr] = i;
      }
    } catch(e) { /* Ignore invalid dates */ }
  }

  return {
    availData: availData,
    playerColMap: playerColMap,
    dateRowMap: dateRowMap
  };
}

/**
 * [HELPER] Builds a Set of blocked dates based on a team's buffer days.
 * 
 * @param {Spreadsheet} ss The active spreadsheet object.
 * @param {string} teamName The team to check (e.g., "M1").
 * @param {number} bufferDays The number of days to buffer.
 * @returns {Set<string>} A Set of date strings ("yyyy-MM-dd") that are blocked.
 */
function _buildTeamBufferBlocklist(ss, teamName, bufferDays) {
  const bookingRequestsSheet = ss.getSheetByName(CONFIG.SHEETS.BOOKING_REQUESTS);
  const requestData = bookingRequestsSheet.getDataRange().getValues();
  const requestHeaders = requestData[0];
  const reqTeamCol = requestHeaders.indexOf('Your Team');
  const reqDateCol = requestHeaders.indexOf('Proposed Date');
  const reqStatusCol = requestHeaders.indexOf(CONFIG.HEADERS.STATUS);
  const bufferBlocklist = new Set();

  if (reqTeamCol === -1 || reqDateCol === -1 || reqStatusCol === -1) {
    throw new Error("Could not find required headers in 'Booking Requests' tab.");
  }

  // Define the team we're looking for ONCE
  const teamNameUpper = teamName.trim().toUpperCase();

  // Loop ONCE
  for (let i = 1; i < requestData.length; i++) {
    const row = requestData[i];
    const teamOnSheet = row[reqTeamCol].trim().toUpperCase();
    const statusOnSheet = row[reqStatusCol];

    // Check if THIS row matches the team we're looking for
    if (teamOnSheet === teamNameUpper && (statusOnSheet === 'Pending' || statusOnSheet === 'Confirmed')) {
      const date = new Date(row[reqDateCol]);
      if (isNaN(date.getTime())) continue;

      // Add buffer days for this date
      for (let dayOffset = -bufferDays; dayOffset <= bufferDays; dayOffset++) {
        let tempDate = new Date(date.getTime());
        tempDate.setDate(tempDate.getDate() + dayOffset);
        bufferBlocklist.add(formatDateForSheet(tempDate));
      }
    }
  }
  return bufferBlocklist;
}

/**
 * [HELPER] Builds an object counting confirmed home bookings for each date.
 * 
 * @param {Spreadsheet} ss The active spreadsheet object.
 * @param {boolean} isHomeMatch If false, returns an empty object.
 * @param {number} maxMatches (Used for logging, not logic here).
 * @returns {Object} A map of { "yyyy-MM-dd": count }
 */
function _buildHomeBookingCount(ss, isHomeMatch) {
  const homeBookingCount = {};
  if (!isHomeMatch) {
    return homeBookingCount;
  }

  const fixturesSheet = ss.getSheetByName(CONFIG.SHEETS.FIXTURES);
  const fixturesData = fixturesSheet.getDataRange().getValues();
  const h = findFixtureHeaders(fixturesData);
  if (!h) { throw new Error("Could not find headers in Fixtures tab."); }

  for (let i = h.headerRowIndex + 1; i < fixturesData.length; i++) {
    const row = fixturesData[i];
    const date = row[h['Date']];
    const homeAway = row[h['Home / Away']];
    const status = row[h['Match Status']];
    if (date && homeAway === 'Home' && status === 'Confirmed') {
      const dateStr = formatDateForSheet(new Date(date));
      if (dateStr) {
        homeBookingCount[dateStr] = (homeBookingCount[dateStr] || 0) + 1;
      }
    }
  }
  return homeBookingCount;
}

/**
 * [HELPER] Gets all info for a team: players and override days.
 * 
 * @param {Spreadsheet} ss The active spreadsheet object.
 * @param {string} teamName The team to find (e.g., "M1").
 * @returns {{players: string[], allowedDays: number[]}} An object containing the player list and an array of allowed day numbers.
 */
function _getTeamInfo(ss, teamName) {
  const teamsSheet = ss.getSheetByName(CONFIG.SHEETS.TEAMS);
  // Use .getDisplayValues() to ensure all player names are read as strings
  const teamsData = teamsSheet.getDataRange().getDisplayValues();

  let players = [];
  let allowedDays = [];

  const teamNameUpper = teamName.trim().toUpperCase();
  for (let i = 1; i < teamsData.length; i++) {
    // Compare uppercase vs uppercase
    if (teamsData[i][1].trim().toUpperCase() == teamNameUpper) { // Team name is in Col B (index 1)
      
      // Get players from the new start/end columns
      players = teamsData[i].slice(
        CONFIG.TEAM_SHEET.PLAYER_START_COL,
        CONFIG.TEAM_SHEET.PLAYER_END_COL
      ).map(p => p.trim()).filter(p => p);

      // Get allowed days from the new column (e.g., "5,0")
      const allowedDaysStr = teamsData[i][CONFIG.TEAM_SHEET.ALLOWED_DAYS_COL] || "";
      allowedDays = allowedDaysStr.toString().split(',')
        .map(d => parseInt(d.trim(), 10))
        .filter(d => !isNaN(d));

      break;
    }
  }

  if (players.length === 0) {
    throw new Error(`Team "${teamName}" not found or has no players listed in 'Teams' sheet.`);
  }

  return { players, allowedDays };
}

/**
 * [HELPER] Gets the Availability data and maps player names to column indices.
 * 
 * @param {Spreadsheet} ss The active spreadsheet object.
 * @param {string[]} players Array of player names to find.
 * @returns {Object} An object containing { data, playerCols, adminLockCol, missingPlayers }
 */
function _getAvailabilityMaps(ss, players) {
  const availabilitySheet = ss.getSheetByName(CONFIG.SHEETS.AVAILABILITY);
  const availData = availabilitySheet.getDataRange().getDisplayValues();
  const headers = availData[0];
  const playerCols = [];
  const missingPlayers = [];

  const playerColMap = {};
  for (let i = 0; i < headers.length; i++) {
    // Convert all sheet headers to uppercase for lookup
    playerColMap[headers[i].trim().toUpperCase()] = i;
  }

  for (const p of players) {
    // Convert player name to uppercase to find the column
    const colIndex = playerColMap[p.trim().toUpperCase()];
    if (colIndex !== undefined) {
      playerCols.push(colIndex);
    } else {
      missingPlayers.push(p);
    }
  }

  const adminLockCol = playerColMap[CONFIG.HEADERS.ADMIN_LOCK] ?? -1;
  if (adminLockCol === -1) {
    Logger.log("Warning: 'ADMIN LOCK' column not found. Admin blocks will not work.");
  }

  return {
    data: availData,
    playerCols: playerCols,
    adminLockCol: adminLockCol,
    missingPlayers: missingPlayers
  };
}

/**
 * [HELPER] Reads the 'Teams' sheet and builds a map of team names to their captain.
 * This is an efficient way to look up captain names.
 * @param {Spreadsheet} ss The active spreadsheet object.
 * @returns {Object.<string, string>} A map where keys are uppercase team names 
 *                                     and values are the captain's name.
 */
function _buildTeamCaptainMap(ss) {
  const teamsSheet = ss.getSheetByName(CONFIG.SHEETS.TEAMS);
  if (!teamsSheet) {
    throw new Error(`The '${CONFIG.SHEETS.TEAMS}' sheet was not found.`);
  }
  const teamsData = teamsSheet.getDataRange().getDisplayValues();
  const captainMap = {};
  // Start from row 1 to skip the header
  for (let i = 1; i < teamsData.length; i++) {
    const row = teamsData[i];
    const teamName = row[1]; // Team name is in Column B (index 1)
    const captainName = row[3]; // Captain name is in Column D (index 3)
    if (teamName && captainName) {
      captainMap[teamName.trim().toUpperCase()] = captainName.trim();
    }
  }
  return captainMap;
}

/**
 * [HELPER] Builds a map of Opponent Club Names to their Contact Info.
 */
function _buildOpponentContactMap(ss) {
  // 1. Try to get sheet using Config, fallback to direct string if Config fails
  let sheetName = "Opponent Info";
  if (CONFIG && CONFIG.SHEETS && CONFIG.SHEETS.OPPONENTS) {
    sheetName = CONFIG.SHEETS.OPPONENTS;
  }
  
  const sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    Logger.log(`CRITICAL ERROR: Could not find sheet named "${sheetName}"`);
    return {};
  }

  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return {};

  // Get headers from Row 1 and trim whitespace
  const headers = data[0].map(h => String(h).trim());

  // --- STRICT HEADER MATCHING (Based on your confirmation) ---
  const clubIdx = headers.indexOf('Club'); 
  const emailIdx = headers.indexOf('Match Secretary Email');
  const nameIdx = headers.indexOf('Match Secretary Name'); 

  // Safety Check
  if (clubIdx === -1 || emailIdx === -1) {
    Logger.log("Error: Could not find 'Club' or 'Match Secretary Email' columns in Opponent Info.");
    Logger.log(`Headers found: ${JSON.stringify(headers)}`);
    return {};
  }

  const map = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const clubName = String(row[clubIdx]).trim();
    const email = String(row[emailIdx]).trim();
    
    // Default to 'Match Secretary' if the name column is missing or empty
    const name = (nameIdx !== -1 && row[nameIdx]) ? String(row[nameIdx]).trim() : 'Match Secretary';

    if (clubName && email) {
      map[clubName] = { name: name, email: email };
    }
  }
  return map;
}
