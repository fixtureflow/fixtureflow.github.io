/*******************************************************************
 * Match Admin System: Validation Functions
 *
 * This file contains helper functions dedicated to validating
 * business rules, such as player availability, court capacity,
 * and booking conflicts. They typically throw errors when a rule
 * is violated.
 *******************************************************************/
//==============================================================
// 5️⃣ VALIDATION
//==============================================================

/**
 * [HELPER] A centralized validation engine for all booking confirmations.
 * Checks for Admin Locks, Player Availability, and (optionally) Court Capacity.
 * Throws a user-friendly error if any validation check fails.
 * @param {string} ourTeamName The name of our team being booked (e.g., "M1").
 * @param {Date} matchDate The JavaScript Date object for the match.
 * @param {boolean} isHomeMatch TRUE if this is a home match (will check court capacity), FALSE otherwise.
 */
function _validateProposal(ourTeamName, matchDate, isHomeMatch) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dateStr = formatDateForSheet(matchDate);

  // --- Validation 1: Player & Admin Availability (Always runs) ---
  try {
    const { players } = _getTeamInfo(ss, ourTeamName); // Reuse our core helper
    if (players.length > 0) {
      const { data: availData, playerCols, adminLockCol, missingPlayers } = _getAvailabilityMaps(ss, players);
      
      const rowIndex = availData.findIndex(r => r[0] && formatDateForSheet(new Date(r[0])) === dateStr);

      if (rowIndex !== -1) {
        // Check for Admin Lock
        if (adminLockCol !== -1 && availData[rowIndex][adminLockCol] !== '') {
          throw new Error(`This date (${dateStr}) is locked for a club holiday or closure.`);
        }
        // Check Player Status
        const conflicts = playerCols.map(col => {
          const status = availData[rowIndex][col].trim().toUpperCase();
          return (status === 'X' || status === 'U' || status === 'R') ? availData[0][col] : null;
        }).filter(Boolean);

        if (conflicts.length > 0) {
          throw new Error(`The following players are not available: ${conflicts.join(', ')}`);
        }
      } else {
        Logger.log(`Validation Warning: The date ${dateStr} was not found in the Availability grid. Player availability could not be checked.`);
      }
    }
  } catch (e) {
    // Re-throw the error with a more specific prefix for clarity
    throw new Error(`Player Availability Check Failed: ${e.message}`);
  }

  // --- Validation 2: Court Capacity (Only runs for Home Matches) ---
  if (isHomeMatch) {
    try {
      const settings = getClubSettings();
      const dayOfWeek = matchDate.getDay();
      const maxKey = _getDaySettingKey(dayOfWeek, 'Max Matches');
      const maxMatches = parseInt(settings[maxKey], 10) || 0;

      if (maxMatches === 0) {
        throw new Error("No home matches are permitted on this day of the week according to your settings.");
      }

      const fixturesSheet = ss.getSheetByName(CONFIG.SHEETS.FIXTURES);
      const fixturesData = fixturesSheet.getDataRange().getValues();
      const h = findFixtureHeaders(fixturesData);
      
      _validateCourtCapacity(fixturesData, h, dateStr, maxMatches); // Reuse our other helper!
    } catch (e) {
      throw new Error(`Court Capacity Check Failed: ${e.message}`);
    }
  }
  // If we reach here, all checks passed.
}

/**
 * [HELPER] Checks for existing 'Pending' or 'Confirmed' requests for the same match.
 * 
 * @param {Array[]} requestData The data from the 'Booking Requests' sheet.
 * @param {Object} booking The new booking object being submitted.
 */
function _validateNoDuplicateRequest(requestData, booking) {
  const headers = requestData[0];
  const reqClubCol = headers.indexOf('Requesting Club');
  const reqTheirTeamCol = headers.indexOf('Their Team');
  const reqYourTeamCol = headers.indexOf('Your Team');
  const reqStatusCol = headers.indexOf(CONFIG.HEADERS.STATUS);

  const ourTeamUpper = booking.ourTeam.trim().toUpperCase();
  const clubUpper = booking.club.trim().toUpperCase();
  const theirTeamUpper = booking.theirTeam.trim().toUpperCase();

  for (let i = 1; i < requestData.length; i++) {
    const row = requestData[i];
    const status = row[reqStatusCol];
    if (
      row[reqYourTeamCol].trim().toUpperCase() === ourTeamUpper &&
      row[reqClubCol].trim().toUpperCase() === clubUpper &&
      row[reqTheirTeamCol].trim().toUpperCase() === theirTeamUpper &&
      (status === 'Pending' || status === 'Confirmed')
    ) {
      throw new Error(`A '${status}' request for this exact match already exists. Please contact the match secretary.`);
    }
  }
  // No error thrown = check passed
}

/**
 * [HELPER] Checks 'Fixtures' sheet for court capacity.
 * 
 * @param {Array[]} fixturesData The data from the 'Fixtures' sheet.
 * @param {Object} h The fixture header map from findFixtureHeaders().
 * @param {string} dateStr The date to check ("yyyy-MM-dd").
 * @param {number} maxMatches The max allowed matches.
 */
function _validateCourtCapacity(fixturesData, h, dateStr, maxMatches) {
  if (!h) { throw new Error("Internal Error: Could not find headers in Fixtures tab."); }
  let homeBookingCount = 0;

  for (let i = h.headerRowIndex + 1; i < fixturesData.length; i++) {
    const row = fixturesData[i];
    if (
      row[h['Date']] &&
      formatDateForSheet(new Date(row[h['Date']])) === dateStr &&
      row[h['Home / Away']] === 'Home' &&
      row[h['Match Status']] === 'Confirmed'
    ) {
      homeBookingCount++;
    }
  }
  if (homeBookingCount >= maxMatches) {
    throw new Error("Sorry, court capacity is full for this date. Please search again.");
  }
  // No error thrown = check passed
}

/**
 * [HELPER] Checks 'Booking Requests' for buffer day conflicts.
 * 
 * @param {Array[]} requestData The data from the 'Booking Requests' sheet.
 * @param {Object} booking The new booking object.
 * @param {number} bufferDays The buffer day setting.
 * @param {Date} dateObj The JS Date object for the new booking.
 */
function _validateTeamBuffer(requestData, booking, bufferDays, dateObj) {
  const headers = requestData[0];
  const reqYourTeamCol = headers.indexOf('Your Team');
  const reqDateCol = headers.indexOf('Proposed Date');
  const reqStatusCol = headers.indexOf(CONFIG.HEADERS.STATUS);

  const ourTeamUpper = booking.ourTeam.trim().toUpperCase();
  for (let i = 1; i < requestData.length; i++) {
    if (
      requestData[i][reqYourTeamCol].trim().toUpperCase() === ourTeamUpper &&
      (requestData[i][reqStatusCol] === 'Pending' || requestData[i][reqStatusCol] === 'Confirmed')
    ) {
      const existingDate = new Date(requestData[i][reqDateCol]);
      if (isNaN(existingDate.getTime())) continue;

      const diffDays = Math.abs((dateObj.getTime() - existingDate.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays <= bufferDays) {
        throw new Error("Sorry, this date is now within the buffer of another booking for this team. Please search again.");
      }
    }
  }
  // No error thrown = check passed
}

/**
 * [HELPER] Checks 'Availability' sheet for player availability and admin locks.
 * 
 * @param {Spreadsheet} ss The active spreadsheet object.
 * @param {Object} booking The new booking object.
 * @param {string} dateStr The date to check ("yyyy-MM-dd").
 */
function _validatePlayerAvailability(ss, booking, dateStr) {
  // 1. Get players for team
  const { players } = _getTeamInfo(ss, booking.ourTeam);

  // 2. Get availability data
  const availabilitySheet = ss.getSheetByName(CONFIG.SHEETS.AVAILABILITY);
  const availData = availabilitySheet.getDataRange().getDisplayValues();
  const availHeaders = availData[0];

  const headerMap = {};
  for (let i = 0; i < availHeaders.length; i++) {
    headerMap[availHeaders[i].trim().toUpperCase()] = i;
  }
  
  const adminLockCol = headerMap[CONFIG.HEADERS.ADMIN_LOCK] ?? -1;
  const playerCols = players
    .map(p => headerMap[p.trim().toUpperCase()])
    .filter(i => i !== undefined && i !== -1);

  // 3. Find the row for the target date
  let rowIndex = -1;
  for (let i = 1; i < availData.length; i++) {
    if (formatDateForSheet(new Date(availData[i][0])) == dateStr) {
      rowIndex = i;
      break;
    }
  }
  if (rowIndex === -1) { throw new Error("Date not found in availability grid. Please contact admin."); }

  // 4. Check Admin Lock
  if (adminLockCol !== -1 && availData[rowIndex][adminLockCol].trim() !== '') {
    throw new Error("Sorry, this date is blocked for a club holiday or closure. Please search again.");
  }

  // 5. Check Player availability
  for (const col of playerCols) {
    const status = availData[rowIndex][col].trim().toUpperCase();
    if (status == 'X' || status == 'U' || status == 'R') { // Any of these marks is a conflict
      const playerName = availHeaders[col]; // Get original player name for the error
      throw new Error(`Sorry, player availability changed (${availHeaders[col]} is '${status}'). Please search again.`);
    }
  }
  // No error thrown = check passed
}
