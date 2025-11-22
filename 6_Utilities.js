/*******************************************************************
 * Match Admin System: Utilities
 *
 * A library of generic, reusable helper functions that are used by
 * multiple parts of the application, such as caching, logging,
 * and date formatting.
 *******************************************************************/
//==============================================================
// 6️⃣ UTILITIES
//==============================================================

/**
 * A generic wrapper to get data from cache or run a function to fetch it.
 * 
 * @param {string} cacheKey The key to store the data under (e.g., "TEAMS_LIST").
 * @param {function} fetchFunction The function to run if data is not in cache (e.g., getOurTeams_).
 * @param {number} expirationInSeconds The time to keep data in cache. 3600 = 1 hour.
 * @returns {Object} The cached or freshly fetched data.
 */
function getCachedData(cacheKey, fetchFunction, expirationInSeconds = 3600) {
  const cache = CacheService.getScriptCache();
  let cached = cache.get(cacheKey);

  if (cached != null) {
    // Found in cache, return it
    return JSON.parse(cached);
  }

  // Not in cache, run the function to get fresh data
  const freshData = fetchFunction();
  const dataToCache = JSON.stringify(freshData);

  // Store in cache
  cache.put(cacheKey, dataToCache, expirationInSeconds);
  return freshData;
}

/**
 * Formats a date object into "EEEE, d MMMM yyyy".
 */
function formatDate(date) {
  try {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'EEEE, d MMMM yyyy');
  } catch (e) { return null; }
}

/**
 * Formats a date object into "yyyy-MM-dd".
 */
function formatDateForSheet(date) {
  try {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) return null;
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  } catch (e) { return null; }
}

/**
 * Parses a date string from "d/m/y" or "y-m-d" into a Date object.
 * V2: Now accepts an optional referenceDate to infer missing year/month on range end-dates.
 */
function parseDMY(dateString, referenceDate = null) {
  try {
    if (!dateString) return new Date('invalid');
    dateString = dateString.trim();

    let parts = dateString.split('-');
    if (parts.length === 3) { /* ... */ }
    
    parts = dateString.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts.map(x => parseInt(x, 10));
      const year = y < 100 ? y + 2000 : y;
      return new Date(year, m - 1, d);
    }

    if (referenceDate instanceof Date && !isNaN(referenceDate.getTime())) {
      if (parts.length === 2) { // Format "d/m"
        const [d, m] = parts.map(x => parseInt(x, 10));
        let refYear = referenceDate.getFullYear();
        if (referenceDate.getMonth() === 11 && m === 1) { refYear++; }
        return new Date(refYear, m - 1, d);
      }
      if (parts.length === 1 && !isNaN(parts[0])) { /* ... */ }
    }

    return new Date(dateString);
  } catch (e) {
    return new Date('invalid');
  }
}

/**
 * Takes a value from a sheet that is supposed to be a time and correctly
 * formats it as a "HH:mm" string, regardless of whether the sheet provides
 * a Date object, a number (fraction of a day), or a pre-formatted string.
 * @param {*} timeValue The value from the sheet's time column.
 * @returns {string} The time formatted as "HH:mm", or "N/A" if input is invalid.
 */
function formatTimeFromSheet(timeValue) {
  if (timeValue instanceof Date) {
    // It's a proper Date object.
    return Utilities.formatDate(timeValue, Session.getScriptTimeZone(), 'HH:mm');
  } 
  if (typeof timeValue === 'number' && timeValue > 0) {
    // It's a number fraction (the "Digital Sundial").
    const baseDate = new Date(1899, 11, 30); // Google Sheets' epoch for time
    const timeInMilliseconds = timeValue * 86400000;
    const timeDate = new Date(baseDate.getTime() + timeInMilliseconds);
    return Utilities.formatDate(timeDate, Session.getScriptTimeZone(), 'HH:mm');
  } 
  if (typeof timeValue === 'string' && timeValue) {
    // It's already a string.
    return timeValue;
  }
  // If none of the above, return a safe default.
  return "N/A";
}

/**
 * Writes an action to the 'System Log' sheet.
 */
function logAction(functionName, summary, counts = {}, notes = '') {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName(CONFIG.SHEETS.SYSTEM_LOG) || ss.insertSheet(CONFIG.SHEETS.SYSTEM_LOG);
    
    // The new, complete header list
    const headers = ['Timestamp', 'User', 'Function', 'Summary', 'Added X', 'Added R', 'Removed X', 'Removed R', 'Removed U', 'Notes'];
    
    if (logSheet.getLastRow() === 0) {
      logSheet.appendRow(headers);
    }
    
    const user = Session.getActiveUser().getEmail() || 'Anonymous';
    
    // The new row now includes slots for the 'U' counts
    logSheet.appendRow([
      new Date(),
      user,
      functionName,
      summary,
      counts.addedX || 0,
      counts.addedR || 0,
      counts.removedX || 0,
      counts.removedR || 0,
      counts.removedU || 0,
      notes
    ]);
  } catch (err) {
    Logger.log(`Error writing to System Log: ${err}`);
  }
}

/**
 * Writes a detailed record of a form submission process to the 'Processing_Log' sheet.
 * This provides a transparent audit trail of how the script interpreted user input.
 */
function logProcessingAction(playerName, rawInput, cleanedInput, daysMarked, adminLockConflicts, status, notes = '') {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const logSheet = ss.getSheetByName(CONFIG.SHEETS.PROCESSING_LOG);

    if (!logSheet) { /* ... */ }
    
    if (logSheet.getLastRow() === 0) {
      const headers = ['Timestamp', 'Player Name', 'Raw Input', 'Cleaned Input', 'Days Marked', 'Admin Lock Conflicts', 'Status', 'Notes'];
      logSheet.appendRow(headers);
    }
    
    logSheet.appendRow([
      new Date(),
      playerName,
      rawInput,
      cleanedInput,
      daysMarked,
      adminLockConflicts, // The new data point
      status,
      notes
    ]);
  } catch (err) {
    Logger.log(`Error writing to Processing_Log: ${err.message}`);
  }
}

/**
 * A robust helper to find all necessary column indices
 * from the 'Fixtures' sheet header row.
 * This searches the first 20 rows to find the header,
 * allowing for title rows above the main table.
 */
function findFixtureHeaders(fixturesData) {
  let headerRowIndex = -1;
  const headers = {};
  const requiredHeaders = [
    'Date', 'Day', 'Time', 'Event', 'Div', 'Sctn', 'League / Cup',
    'Your Club', 'Team No.', 'Home / Away', 'Opposition Club',
    'Opp Team No.', 'Venue / Hall', 'Match Status'
  ];

  const MAX_HEADER_SEARCH_ROWS = 20;
  for (let i = 0; i < Math.min(fixturesData.length, MAX_HEADER_SEARCH_ROWS); i++) {
    const row = fixturesData[i];
    let foundCount = 0;

    for (const header of requiredHeaders) {
      const col = row.indexOf(header);
      if (col !== -1) {
        headers[header] = col;
        foundCount++;
      }
    }

    // If this row contains all required headers, we found it.
    if (foundCount === requiredHeaders.length) {
      headerRowIndex = i;
      break;
    }
  }

  if (headerRowIndex === -1) {
    Logger.log('Error: Could not find all required headers in "Fixtures" sheet.');
    Logger.log(`Missing: ${requiredHeaders.filter(h => !headers.hasOwnProperty(h)).join(', ')}`);
    return null;
  }

  headers.headerRowIndex = headerRowIndex;
  return headers;
}

/**
 * Converts a day name (e.g., "Tuesday") to a JavaScript day number (0-6).
 * @param {string} dayName - The name of the day.
 * @returns {number} 0 for Sunday, 1 for Monday, ..., 6 for Saturday. -1 if invalid.
 */
function getDayOfWeekNumber(dayName) {
  const days = {
    'sunday': 0,
    'monday': 1,
    'tuesday': 2,
    'wednesday': 3,
    'thursday': 4,
    'friday': 5,
    'saturday': 6
  };
  return days[dayName.toLowerCase().trim()] ?? -1;
}

/**
 * [HELPER] Gets the correct settings key for a given day of the week.
 * 
 * @param {number} dayOfWeek The day number (0=Sun, 6=Sat).
 * @param {string} settingType The setting suffix (e.g., "Venue", "Time Slot", "Max Matches").
 * @returns {string} The key for the Settings sheet (e.g., "Day 2 (Tue) Venue").
 */
function _getDaySettingKey(dayOfWeek, settingType) {
  const dayNames = [
    "Day 0 (Sun)", "Day 1 (Mon)", "Day 2 (Tue)", "Day 3 (Wed)",
    "Day 4 (Thu)", "Day 5 (Fri)", "Day 6 (Sat)"
  ];
  
  if (dayOfWeek < 0 || dayOfWeek > 6) {
    Logger.log(`Invalid dayOfWeek passed to _getDaySettingKey: ${dayOfWeek}`);
    return `Day 0 (Sun) ${settingType}`; // Return Sunday as a safe fallback
  }
  
  return `${dayNames[dayOfWeek]} ${settingType}`;
}

/**
 * Gets a sorted list of player names from the 'Availability' sheet header.
 * Used by the 'Clear Player Unavailability' sidebar.
 * @returns {string[]} An array of player names.
 */
function getClearablePlayerList() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const availabilitySheet = ss.getSheetByName(CONFIG.SHEETS.AVAILABILITY);
    if (!availabilitySheet) {
      throw new Error("Could not find the 'Availability' sheet.");
    }
    const headers = availabilitySheet.getRange(1, 1, 1, availabilitySheet.getLastColumn()).getValues()[0];
    
    // Filter out non-player columns like 'Date' and 'ADMIN_LOCK'
    const nonPlayerHeaders = ['DATE', 'ADMIN_LOCK']; // Add any others if needed
    const players = headers.filter(header => {
      const h = header.trim().toUpperCase();
      return h && !nonPlayerHeaders.includes(h);
    });

    return players.sort(); // Return a sorted list
  } catch (e) {
    Logger.log(`Error in getClearablePlayerList: ${e.message}`);
    // Re-throw the error so the UI can display it
    throw new Error(`Failed to load player list: ${e.message}`);
  }
}

/**
 * [HELPER] Determines the match event type based on the team name prefix.
 * 
 * @param {string} teamName The team name (e.g., "L1", "M2", "X3").
 * @returns {string} The event name ("Ladies", "Mens", "Mixed", or "").
 */
function _getEventFromTeamName(teamName) {
  if (!teamName) return '';
  const prefix = teamName.substring(0, 1).toUpperCase();
  if (prefix === 'L') { return 'Ladies'; }
  if (prefix === 'M') { return 'Mens'; }
  if (prefix === 'X') { return 'Mixed'; }
  return '';
}

/**
 * [HELPER] Gets the division for a team from the 'Teams' sheet.
 * Used as a fallback when appending a new fixture.
 */
function _getDivisionFromTeamName(ss, teamName) {
  try {
    const teamsSheet = ss.getSheetByName(CONFIG.SHEETS.TEAMS);
    const teamsData = teamsSheet.getDataRange().getValues();
    for (let i = 1; i < teamsData.length; i++) {
      if (teamsData[i][1] === teamName) {
        return teamsData[i][0]; // Return division from Column A
      }
    }
  } catch (e) {
    Logger.log(`Could not find division for team ${teamName}: ${e.message}`);
  }
  return ''; // Return blank if not found
}

/**
 * [HELPER] Sends a standardized rejection email for any booking type.
 * It intelligently chooses the correct email template based on the context.
 */
function _sendRejectionEmail(isHomeRejection, opponentClubName, opponentTeamName, ourTeamNumber, opponentEmail, rejectedDate, rejectedTime, venue = '') {
  try {
    // 1. Get Settings
    const settings = getClubSettings_(); // Use the backend getter
    const webAppUrl = settings['Web App URL'];
    const ourClubName = settings['Club Name'] || 'Match Secretary';

    // 2. Prepare Data
    const dateStr = formatDateForSheet(rejectedDate) || 'a recent date';
    const perspective = isHomeRejection ? '(Your AWAY Match)' : '(Your HOME Match)';
    const originalSubject = `Match Request Not Approved: ${opponentClubName} ${opponentTeamName} ${perspective} vs ${ourClubName} on ${dateStr}`;
    const formattedDate = formatDate(rejectedDate) || "N/A";
    const formattedTime = formatTimeFromSheet(rejectedTime);

    // 3. Choose Template
    const templateName = isHomeRejection ? 'RejectionEmail.html' : 'AwayRejectionEmail.html';
    const template = HtmlService.createTemplateFromFile(templateName);

    // Pass standardized variables
    template.webAppUrl = webAppUrl;
    template.opponentClubName = opponentClubName;
    template.opponentTeamName = opponentTeamName;
    template.ourClubName = ourClubName;
    template.ourTeamNumber = ourTeamNumber;
    template.formattedDate = formattedDate;
    template.formattedTime = formattedTime;
    template.venueName = venue;

    const htmlBody = template.evaluate().getContent();
    const plainBody = htmlBody.replace(/<[^>]+>/g, ''); // Basic strip tags

    // 4. SEND EMAIL (Updated to use Master Helper)
    // This handles branding ("Mount Pleasant Match Secretary"), Reply-To, and Test Mode automatically.
    const sentInfo = _sendClubEmail(opponentEmail, originalSubject, htmlBody, settings, plainBody);

    Logger.log(`Rejection email sent to ${sentInfo.recipient}. Template: ${templateName}`);
    return sentInfo;

  } catch (e) {
    Logger.log(`Failed to send rejection email: ${e.message}\nStack: ${e.stack}`);
    throw new Error(`Failed to send email. Original error: ${e.message}`);
  }
}

/**
 * [HELPER] Determines the final recipient and subject line for an email based on the system's
 * test mode settings. This centralizes the test mode logic for all email functions.
 * @param {string} intendedRecipient - The real email address the email should go to in production.
 * @param {string} originalSubject - The subject line for a normal production email.
 * @param {Object} settings - The club settings object from getClubSettings().
 * @returns {{recipient: string, subject: string}} An object containing the final 'recipient' and 'subject'.
 */
function _getRecipientAndSubject(intendedRecipient, originalSubject, settings) {
  const isTestModeActive = String(settings['Test Mode Active'] || '').trim().toUpperCase() === 'TRUE';
  const testEmailRecipient = settings['Test Mode Email'];

  let finalRecipient = intendedRecipient;
  let finalSubject = originalSubject;

  // Only enter test mode if the switch is ON AND a test email is provided.
  if (isTestModeActive && testEmailRecipient) {
    finalRecipient = testEmailRecipient;
    finalSubject = `[TEST] ${originalSubject} (Intended for: ${intendedRecipient})`;
  }
  
  return { recipient: finalRecipient, subject: finalSubject };
}

/**
 * [CENTRALIZED HELPER] Sends an email with consistent Club Branding and Safety Checks.
 * Automatically handles:
 * 1. Test Mode Redirection (via _getRecipientAndSubject)
 * 2. 'From' Name (e.g. "Mount Pleasant Match Secretary")
 * 3. 'Reply-To' Address (Directs replies to the club email)
 *
 * @param {string} recipient - The intended real email address.
 * @param {string} subject - The email subject.
 * @param {string} htmlBody - The HTML content.
 * @param {Object} settings - The club settings object.
 * @param {string} [plainBody] - (Optional) Plain text fallback.
 */
function _sendClubEmail(recipient, subject, htmlBody, settings, plainBody = "") {
  
  // 1. Apply Safety/Test Mode Logic
  const emailInfo = _getRecipientAndSubject(recipient, subject, settings);
  
  // 2. Prepare Branding
  const clubName = settings['Club Name'] || 'Fixture Flow';
  const replyToAddress = settings['Match Secretary Email'];

  const options = {
    to: emailInfo.recipient,
    subject: emailInfo.subject,
    htmlBody: htmlBody,
    name: `${clubName} Match Secretary`
  };

  if (replyToAddress) options.replyTo = replyToAddress;
  if (plainBody) options.body = plainBody;

  MailApp.sendEmail(options);
  
  // RETURN this info so the caller can log "Sent to [Real Recipient]"
  return emailInfo; 
}