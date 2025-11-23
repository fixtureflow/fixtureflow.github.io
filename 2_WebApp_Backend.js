/*******************************************************************
 * Match Admin System: Web App - Backend Logic
 * 
 * Contains the core backend functions that perform actions
 * requested by the web application, such as finding available
 * dates and submitting new booking requests.
 *******************************************************************/
//==============================================================
// 2️⃣ WEB APP - BACKEND LOGIC
//==============================================================

/**
 * [WEB APP] Public-facing function for the web app to find HOME match dates.
 * 
 * @param {string} teamName The team name.
 * @param {number} month The month (1-12).
 * @param {number} year The year.
 * @returns {string[]} Array of available date strings.
 */
function findAvailableDatesForTeam(teamName, month, year) {
  const settings = getClubSettings();
  return findAvailableDates_(teamName, month, year, true, settings); // isHomeMatch = true
}

/**
 * [WEB APP] Public-facing function for the sidebar to find AWAY match dates.
 * 
 * @param {string} teamName The team name.
 * @param {number} month The month (1-12).
 * @param {number} year The year.
 * @returns {string[]} Array of available date strings.
 */
function findAvailableDatesForAwayMatch(teamName, month, year) {
  const settings = getClubSettings();
  return findAvailableDates_(teamName, month, year, false, settings); // isHomeMatch = false
}

/**
 * [HELPER] Finds available dates for a team.
 * This is the core validation logic for the web app.
 * REFACTORED: Now delegates data-gathering to private helpers.
 *
 * @param {string} teamName The name of the team (e.g., "M1").
 * @param {number} month The month (1-12).
 * @param {number} year The full year (e.g., 2025).
 * @param {boolean} isHomeMatch True if checking for a home match (checks court capacity),
 * False if for an away match (skips capacity check).
 * @param {Object} settings The club settings object.
 * @returns {string[]} An array of available date strings ("yyyy-MM-dd").
 */
function findAvailableDates_(teamName, month, year, isHomeMatch, settings) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // --- Get settings first ---
    // const settings = getClubSettings(); // Removed (passed in)
    const blockedDays = (settings['Blocked Weekdays (0=Sun, 6=Sat)'] || "").split(',');
    const bufferDays = parseInt(settings['Team Buffer Days (each side)'], 10) || 2;

    // --- 1. Delegate data gathering ---
    const bufferBlocklist = _buildTeamBufferBlocklist(ss, teamName, bufferDays);
    const homeBookingCount = _buildHomeBookingCount(ss, isHomeMatch);
    const { players, allowedDays } = _getTeamInfo(ss, teamName);

    // --- 2. Get availability data & maps ---
    const availInfo = _getAvailabilityMaps(ss, players);
    if (availInfo.missingPlayers.length > 0) {
      Logger.log(`Warning: Not all players for team ${teamName} found in Availability: ${availInfo.missingPlayers.join(', ')}`);
    }

    // --- 3. Find all 100% available dates in that month ---
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const availableDates = [];
    for (let i = 1; i < availInfo.data.length; i++) {
      const dateStr = availInfo.data[i][0];
      const dateObj = new Date(dateStr);
      const dayOfWeek = dateObj.getDay().toString(); // Get day as a string "5"

      if (dateObj.getFullYear() === year && (dateObj.getMonth() + 1) === month) {

        // Check 1: Past Date
        if (dateObj <= today) {
          continue; // Skip this date because it's in the past.
        }

        // Check 2: Admin Lock
        if (availInfo.adminLockCol !== -1 && availInfo.data[i][availInfo.adminLockCol] !== '') {
          continue;
        }

        const formattedDateStr = formatDateForSheet(dateObj);

        // Check 3: Team Buffer
        if (bufferBlocklist.has(formattedDateStr)) { continue; }

        // Check 4: Blocked Weekdays (Only for Home Matches)
        if (isHomeMatch && blockedDays.includes(dayOfWeek)) {
          // It's a blocked day for a home match. Check if this team has an override.
          if (!allowedDays.includes(parseInt(dayOfWeek, 10))) {
            // No override, so skip this date.
            continue;
          }
          // If we are here, this team *is* allowed, so we continue checking.
        }

        // Check 4: Court Capacity (Only for Home Matches)
        if (isHomeMatch) {
          const maxKey = _getDaySettingKey(dateObj.getDay(), 'Max Matches');
          const maxMatchesForThisDay = parseInt(settings[maxKey], 10) || 0;
          
          if (maxMatchesForThisDay === 0) { continue; } // Day is explicitly blocked

          if (homeBookingCount[formattedDateStr] >= maxMatchesForThisDay) {
            continue; // Court capacity is full for this specific day
          }
        }

        // Check 5: Player Availability
        let isFullyAvailable = true;
        for (const col of availInfo.playerCols) {
          // Trim whitespace and convert to uppercase for a robust check
          const status = availInfo.data[i][col].trim().toUpperCase();
          if (status === 'X' || status === 'U' || status === 'R') {
            isFullyAvailable = false;
            break;
          }
        }
		
        // If all checks passed, add the date
        if (isFullyAvailable) {
          availableDates.push(formattedDateStr);
        }
      }
    }
    return availableDates;

  } catch (e) {
    Logger.log(`Error in findAvailableDates_ for ${teamName}: ${e.message}\nStack: ${e.stack}`);
    throw new Error(e.message); // Pass error to the web app
  }
}

/**
 * [WEB APP] Submits a new booking request. Runs all validation checks again
 * inside a lock to prevent double-bookings.
 * REFACTORED: Now delegates validation logic to private helpers.
 * 
 * @param {Object} booking The booking object.
 * @returns {string} "Success" or error message.
 */
function submitBookingRequest(booking) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const settings = getClubSettings();
    const dateObj = parseDMY(booking.date);
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Invalid date format provided: ${booking.date}`);
    }
    const dayOfWeek = dateObj.getDay();
    const maxKey = _getDaySettingKey(dayOfWeek, 'Max Matches');
    const maxMatches = parseInt(settings[maxKey], 10) || 0;
    if (maxMatches === 0) {
      throw new Error("Sorry, no matches are allowed on this day of the week. Please search again.");
    }
    const bufferDays = parseInt(settings['Team Buffer Days (each side)'], 10) || 2;

    
    const dateStr = formatDateForSheet(dateObj); // Use our own formatter

    // --- Get shared data once ---
    const requestSheet = ss.getSheetByName(CONFIG.SHEETS.BOOKING_REQUESTS);
    const requestData = requestSheet.getDataRange().getValues();
    const fixturesSheet = ss.getSheetByName(CONFIG.SHEETS.FIXTURES);
    const fixturesData = fixturesSheet.getDataRange().getValues();
    const fixturesHeaders = findFixtureHeaders(fixturesData);

    // *** Run All Validation Checks ***
    // Each function will throw an error if it fails.

    _validateNoDuplicateRequest(requestData, booking);
    _validateCourtCapacity(fixturesData, fixturesHeaders, dateStr, maxMatches);
    _validateTeamBuffer(requestData, booking, bufferDays, dateObj);
    _validatePlayerAvailability(ss, booking, dateStr);

    // *** IF ALL CHECKS PASS, APPEND THE ROW ***
    requestSheet.appendRow([
      new Date(),           // Timestamp
      booking.club,
      booking.theirTeam,
      booking.ourTeam,
      dateObj,              // Proposed Date
      booking.time,         // Proposed Time
      booking.email,
      booking.matchType,
      'Pending'             // Status
    ]);

    return "Success";

  } catch (e) {
    Logger.log(`Error in submitBookingRequest: ${e.message}\nStack: ${e.stack}`);
    return "Error: " + e.message; // Send the user-friendly error message to the web app
  } finally {
    lock.releaseLock();
  }
}

/**
 * [WEB APP] Submits a new AWAY match proposal from an opponent.
 * This function performs minimal validation and writes the proposal
 * to the 'Away Match Proposals' sheet for admin approval.
 *
 * @param {object} proposal - An object containing the away booking details.
 * @returns {string} "Success" or an error message.
 */
function submitAwayBookingRequest(proposal) {
  // Use a lock to prevent simultaneous submissions from causing issues.
  const lock = LockService.getScriptLock();
  lock.waitLock(30000); 

  try {
    // --- Basic Validation ---
    if (!proposal.club || !proposal.theirTeam || !proposal.ourTeam || !proposal.date || !proposal.time || !proposal.venue || !proposal.email) {
      throw new Error("A required field was missing. Please fill out the entire form.");
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const awayProposalSheet = ss.getSheetByName(CONFIG.SHEETS.AWAY_MATCH_PROPOSALS);

    if (!awayProposalSheet) {
      throw new Error("Internal server error: The proposal destination sheet was not found.");
    }
    
    const dateObj = parseDMY(proposal.date);
    if (isNaN(dateObj.getTime())) {
      throw new Error(`Invalid date format provided: ${proposal.date}`);
    }

    // --- Write to the Sheet ---
    // The order must match the column order in your sheet
    awayProposalSheet.appendRow([
      new Date(),             // A: Timestamp
      proposal.club,          // B: Opponent Club
      proposal.theirTeam,     // C: Their Team
      proposal.ourTeam,       // D: Our Team
      dateObj,                // E: Proposed Date
      proposal.time,          // F: Propose Time
      proposal.email,         // G: Contact Email
      proposal.matchType,     // H: Match Type   
      proposal.venue,         // I: Venue
      'Pending'               // J: Status
    ]);

    // If we get here, everything worked.
    return "Success";

  } catch (e) {
    Logger.log(`Error in submitAwayBookingRequest: ${e.message}\nStack: ${e.stack}`);
    // Return a user-friendly error message to the web app
    return "Error: " + e.message; 
  } finally {
    // Always release the lock
    lock.releaseLock();
  }
}