/*******************************************************************
 * Match Admin System: Spreadsheet Admin Logic
 *
 * This file contains the "heavy lifting" logic for the admin functions.
 * It is separated from the triggers and menu items to improve maintainability
 * and prepare for library migration.
 *******************************************************************/

//==============================================================
// CORE ADMIN LOGIC
//==============================================================

/**
 * [CORE] Syncs all confirmed fixtures from 'Fixtures' to 'Availability'.
 * This function is now a "manager" that delegates tasks to helper functions.
 * 
 * @param {boolean} silent If true, suppresses the final UI alert (for automated calls).
 * @returns {Object|null} A summary object of changes, or null if failed.
 */
function fillAvailabilityX(silent = false) {
  const ui = SpreadsheetApp.getUi(); 
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    // --- 1. GET SETTINGS & INITIAL DATA ---
    const settings = getClubSettings_();
    const clubName = settings['Club Name'];
    const bufferDays = parseInt(settings['Team Buffer Days (each side)'], 10) || 2;
    const fixturesSheet = ss.getSheetByName(CONFIG.SHEETS.FIXTURES);
    if (!fixturesSheet) throw new Error(`'${CONFIG.SHEETS.FIXTURES}' sheet not found.`);
    
    // --- 2. BUILD DATA MAPS USING HELPERS ---
    const teamMap = _buildTeamPlayerMap(ss);
    const { availData, playerColMap, dateRowMap } = _buildAvailabilityGridMaps(ss);
    const fixturesData = fixturesSheet.getDataRange().getValues();
    const h = findFixtureHeaders(fixturesData);
    if (!h) throw new Error('Could not find headers in "Fixtures" sheet.');

    // --- 3. CALCULATE THE REQUIRED STATE ---
    const result = _calculateRequiredMarks(fixturesData, h, teamMap, playerColMap, dateRowMap, availData, clubName, bufferDays);

    // --- 4. APPLY CHANGES TO THE SHEET ---
    const availabilitySheet = ss.getSheetByName(CONFIG.SHEETS.AVAILABILITY);
    const { addedX, addedR, removedX, removedR } = _applyAvailabilityChanges(availabilitySheet, availData, result.required, playerColMap);

    // --- 5. LOG & RETURN ---

    // Log the "U vs X" conflicts
    if (result.uVsXConflicts.length > 0) {
      for (const c of result.uVsXConflicts) {
        const notes = `Player '${c.player}' is marked 'U' but is required for match vs ${c.opponent} on ${c.date}.`;
        logProcessingAction(c.player, 'Conflict (U vs X)', `Date: ${c.date}`, 0, 0, 'Conflict Detected', notes);
      }
    }

    // Log the "X vs X" (double-booking) conflicts
    if (result.doubleBookingConflicts.length > 0) {
      for (const c of result.doubleBookingConflicts) {
        const notes = `Player '${c.player}' is double-booked on ${c.date} for a match with team ${c.team} (vs ${c.opponent}).`;
        logProcessingAction(c.player, 'Conflict (X vs X)', `Date: ${c.date}`, 0, 0, 'Conflict Detected', notes);
      }
    }

    // --- 6. BUILD FINAL ALERT, LOG HIGH-LEVEL EVENT, & RETURN ---
    let finalAlert = `Sync Complete!\n\n- Added: ${addedX} 'X's, ${addedR} 'R's.\n- Removed: ${removedX} 'X's, ${removedR} 'R's.`;
    const uVsXConflictsFound = result.uVsXConflicts.length;
    const doubleBookingsFound = result.doubleBookingConflicts.length;

    if (uVsXConflictsFound > 0 || doubleBookingsFound > 0) {
      finalAlert += `\n\n⚠️ CONFLICTS FOUND:`;
      if (uVsXConflictsFound > 0) finalAlert += `\n- ${uVsXConflictsFound} player(s) unavailable for a match.`;
      if (doubleBookingsFound > 0) finalAlert += `\n- ${doubleBookingsFound} player(s) double-booked for matches.`;
      finalAlert += `\n\nPlease check the 'Processing_Log' for details.`;
    }
    
    if (!silent) {
      ui.alert('Sync Fixtures to Availability', finalAlert, ui.ButtonSet.OK);
    }
    // Log the high-level summary of the action to the Event_Log.
    logAction('fillAvailabilityX', 'Synced Fixtures to Availability', { addedX, addedR, removedX, removedR });

    // --- Return a complete summary object ---
    return { 
      addedX, 
      addedR, 
      removedX, 
      removedR, 
      uVsXConflicts: result.uVsXConflicts.length, 
      doubleBookingConflictsFound: result.doubleBookingConflicts.length
    };

  } catch (e) {
    console.log(`Error during fillAvailabilityX: ${e.message}\nStack: ${e.stack}`);
    if (!silent) {
      ui.alert(`Sync failed: ${e.message}`);
    }
    return null;
  }
}

/**
 * [CORE] Processes new 'U' (Unavailable) submissions from 'Form Responses 1'.
 * Reads the form responses, parses dates, and updates the Availability sheet.
 */
function processSubmissions() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const form = ss.getSheetByName(CONFIG.SHEETS.FORM_RESPONSES);
  const availSheet = ss.getSheetByName(CONFIG.SHEETS.AVAILABILITY);

  if (!form || !availSheet) {
    ui.alert('Error: Missing required sheets.');
    return;
  }

  const formData = form.getDataRange().getValues();
  const availRange = availSheet.getDataRange();
  const availData = availRange.getValues();

  const headers = availData[0];
  const playerMap = {};
  for (let j = 1; j < headers.length; j++) playerMap[headers[j].trim().toUpperCase()] = j;
  const dateMap = {};
  for (let i = 1; i < availData.length; i++) {
    const d = formatDateForSheet(new Date(availData[i][0]));
    if (d) dateMap[d] = i;
  }
  const adminLockCol = playerMap[CONFIG.HEADERS.ADMIN_LOCK] ?? -1;

  const h = formData[0];
  const playerIdx = h.indexOf(CONFIG.HEADERS.PLAYER_NAME);
  const datesIdx = h.indexOf(CONFIG.HEADERS.UNAVAILABLE_DATES);
  const statusIdx = h.indexOf(CONFIG.HEADERS.STATUS);
  if (playerIdx === -1 || datesIdx === -1 || statusIdx === -1) {
    ui.alert("Error: Could not find required headers in 'Form Responses 1'.");
    return;
  }

  let totalDaysProcessedInRun = 0;
  let rowsToUpdate = 0;
  let masterConflictNotes = [];

  for (let i = 1; i < formData.length; i++) {
    if (formData[i][statusIdx]) continue;
    rowsToUpdate++;
    
    const player = formData[i][playerIdx];
    const rawInput = String(formData[i][datesIdx]);
    
    let daysMarkedForThisSubmission = 0;
    let adminLockConflictCount = 0;
    let singleSubmissionConflictNotes = [];
    let cleanedInputForLog = '';
    let processingStatus = 'Success';
    let detailedNotes = [];

    try {
      const col = playerMap[player.trim().toUpperCase()];
      if (!col) throw new Error('Player Not Found');

      // --- NEW, SELF-DOCUMENTING STRUCTURE ---
      // 1. Extract a clean array of date fragments using the new helper function.
      const dates = _extractDateFragments(rawInput);
      
      // 2. It creates the multi-line string AND standardizes hyphen spacing in one chain.
      cleanedInputForLog = dates.join('\n').replace(/\s*-\s*/g, ' - ');
      
      // 3. Process the clean array.
      for (let d of dates) {
        let result;
        if (d.toLowerCase().startsWith('every ')) {
          const dayName = d.substring(6).replace(/s$/, '');
          const dayOfWeek = getDayOfWeekNumber(dayName);
          if (dayOfWeek === -1) {
            detailedNotes.push(`Skipped unrecognized recurring day: "${d}"`);
            continue;
          }
          for (let r = 1; r < availData.length; r++) {
            try {
              const dateObj = new Date(availData[r][0]);
              if (isNaN(dateObj.getTime())) continue;
              if (dateObj.getDay() === dayOfWeek) {
                result = processDate(dateObj, col, player, singleSubmissionConflictNotes, availData, dateMap, adminLockCol);
                if (result === 1) daysMarkedForThisSubmission++;
                else if (result === -1) adminLockConflictCount++;
              }
            } catch (e) { /* ignore */ }
          }
        } else if (d.includes('-')) {
           const [startStr, endStr] = d.split('-').map(s => s.trim());
           let currentDate = parseDMY(startStr);
           const endDate = parseDMY(endStr);
           if (isNaN(currentDate.getTime()) || isNaN(endDate.getTime())) {
             detailedNotes.push(`Skipped invalid date(s) in range: "${d}"`);
             continue;
           }
           if (endDate < currentDate) {
             detailedNotes.push(`Skipped Inverted Range: "${d}"`);
             continue;
           }
           while (currentDate <= endDate) {
             result = processDate(new Date(currentDate), col, player, singleSubmissionConflictNotes, availData, dateMap, adminLockCol);
             if (result === 1) daysMarkedForThisSubmission++;
             else if (result === -1) adminLockConflictCount++;
             else if (result === -3) {
               detailedNotes.push(`Skipped Out-of-Range Date: "${formatDateForSheet(new Date(currentDate))}"`);
             }
             currentDate.setDate(currentDate.getDate() + 1);
           }
        } else {
           const date = parseDMY(d);
           if (isNaN(date.getTime())) {
             if (d.match(/\d/)) {
                detailedNotes.push(`Skipped unparsable date fragment: "${d}"`);
             }
             continue;
           }
           result = processDate(date, col, player, singleSubmissionConflictNotes, availData, dateMap, adminLockCol);
           if (result === 1) daysMarkedForThisSubmission++;
           else if (result === -1) adminLockConflictCount++;
           else if (result === -3) {
            detailedNotes.push(`Skipped Out-of-Range Date: "${d}"`);
           }
        }
      }

      if (singleSubmissionConflictNotes.length > 0 || adminLockConflictCount > 0) {
        processingStatus = 'Partial Success (Conflicts Found)';
      }
      if (singleSubmissionConflictNotes.length > 0) {
          detailedNotes.push(...singleSubmissionConflictNotes);
          masterConflictNotes.push(...singleSubmissionConflictNotes);
      }
      
    } catch (e) {
      processingStatus = 'Error';
      detailedNotes.push(e.message);
    }

    logProcessingAction(player, rawInput, cleanedInputForLog, daysMarkedForThisSubmission, adminLockConflictCount, processingStatus, detailedNotes.join('\n'));
    
    totalDaysProcessedInRun += daysMarkedForThisSubmission;
    formData[i][statusIdx] = 'Processed';
  }

  // Final summary logic
  if (rowsToUpdate > 0) {
    availRange.setValues(availData);
    form.getRange(2, statusIdx + 1, formData.length - 1, 1).setValues(formData.slice(1).map(row => [row[statusIdx]]));
    const conflictSummary = masterConflictNotes.length > 0 ? `\n(${masterConflictNotes.length} total conflicts were found.)` : '';
    ui.alert(`Process Complete!\n\nMarked ${totalDaysProcessedInRun} individual day(s) as 'U'.\nCheck the 'Processing_Log' sheet for a detailed breakdown.${conflictSummary}`);
  } else {
    ui.alert('No new form submissions to process.');
  }
}

/**
 * [HELPER] Core logic to clear all 'U' marks for a specific player.
 * Ignores 'X' (match) and 'R' (rest) marks.
 * 
 * @param {string} playerName The exact name of the player.
 * @returns {number} The count of 'U' marks removed.
 */
function _clearPlayerUnavailability(playerName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const availabilitySheet = ss.getSheetByName(CONFIG.SHEETS.AVAILABILITY);

  if (!availabilitySheet) {
    throw new Error(`'${CONFIG.SHEETS.AVAILABILITY}' sheet not found.`);
  }

  const availDataRange = availabilitySheet.getDataRange();
  const availData = availDataRange.getValues(); // Get raw values for efficiency
  const availDisplayData = availDataRange.getDisplayValues(); // Get display values for robust header matching

  const headers = availDisplayData[0]; // Use display values for header matching

  let playerColIndex = -1;
  // Find the column for the given player
  for (let j = 0; j < headers.length; j++) {
    if (headers[j].trim().toUpperCase() === playerName.trim().toUpperCase()) {
      playerColIndex = j;
      break;
    }
  }

  if (playerColIndex === -1) {
    throw new Error(`Player "${playerName}" not found in the header row of the '${CONFIG.SHEETS.AVAILABILITY}' sheet.`);
  }

  let removedCount = 0;
  const newData = availData.map(row => [...row]); // Create a mutable copy of the data

  // Iterate through the player's column (starting from row 1, skipping header)
  for (let i = 1; i < newData.length; i++) {
    const cellValue = String(newData[i][playerColIndex]).trim().toUpperCase(); // Ensure string and uppercase for comparison

    if (cellValue === 'U') {
      newData[i][playerColIndex] = ''; // Clear the 'U' mark
      removedCount++;
    }
    // We intentionally leave 'X' and 'R' marks untouched
  }

  // Write all changes back to the sheet in one go
  if (removedCount > 0) {
    availDataRange.setValues(newData);
    logAction('clearPlayerUnavailability', `Cleared 'U' marks for ${playerName}`, { removedU: removedCount });
  }

  return removedCount;
}

/**
 * [TRIGGER] Generic Version.
 * Sends internal summary (Matches + Detailed Shuttle Report) AND courtesy reminders to Opponents.
 * Scheduled to run weekly (e.g., Friday afternoon).
 */
function sendWeeklyMatchSummary() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  try {
    // --- 1. Define Date Range (Next Week Mon-Sun) ---
    const today = new Date();
    const dayOfWeek = today.getDay(); 
    const daysToAdd = (dayOfWeek === 0) ? 1 : 8 - dayOfWeek;
    const startOfNextWeek = new Date(today);
    startOfNextWeek.setDate(today.getDate() + daysToAdd);
    startOfNextWeek.setHours(0, 0, 0, 0);
    const endOfNextWeek = new Date(startOfNextWeek);
    endOfNextWeek.setDate(startOfNextWeek.getDate() + 6);
    endOfNextWeek.setHours(23, 59, 59, 999);

    // --- 2. Get Data & Settings ---
    const fixturesSheet = ss.getSheetByName(CONFIG.SHEETS.FIXTURES);
    if (!fixturesSheet) throw new Error("Fixtures sheet not found.");
    const fixturesData = fixturesSheet.getDataRange().getValues();
    const h = findFixtureHeaders(fixturesData);
    if (!h) throw new Error("Could not find headers in Fixtures sheet.");

    const settings = getClubSettings_();
    const clubEmail = settings['Match Secretary Email'];
    const clubName = settings['Club Name'];
    const opponentContactMap = _buildOpponentContactMap(ss);
    const captainMap = (typeof _buildTeamCaptainMap === 'function') ? _buildTeamCaptainMap(ss) : {};

    if (!clubEmail) throw new Error("'Match Secretary Email' is not set in Settings.");

    const matchesByDay = {};       
    const matchesByOpponent = {};  
    let matchTubesNeeded = 0; 
    const shuttleAllocationDetails = [];

    // --- 3. Process Fixtures ---
    for (let i = h.headerRowIndex + 1; i < fixturesData.length; i++) {
      const row = fixturesData[i];
      if (row[h[CONFIG.HEADERS.FIXTURE_STATUS]] === CONFIG.STATUSES.CONFIRMED && row[h[CONFIG.HEADERS.FIXTURE_DATE]]) {
        const matchDate = new Date(row[h[CONFIG.HEADERS.FIXTURE_DATE]]);
        
        if (matchDate >= startOfNextWeek && matchDate <= endOfNextWeek) {
          const dateStr = formatDateForSheet(matchDate);
          const timeStr = row[h[CONFIG.HEADERS.FIXTURE_TIME]] ? Utilities.formatDate(new Date(row[h[CONFIG.HEADERS.FIXTURE_TIME]]), Session.getScriptTimeZone(), 'HH:mm') : 'TBC';
          const ourTeam = row[h[CONFIG.HEADERS.FIXTURE_OUR_TEAM]];
          const homeAway = row[h[CONFIG.HEADERS.FIXTURE_HOME_AWAY]];
          const leagueCup = row[h[CONFIG.HEADERS.FIXTURE_LEAGUE_CUP]];
          const oppClub = row[h[CONFIG.HEADERS.FIXTURE_OPP_CLUB]];
          const oppTeam = row[h[CONFIG.HEADERS.FIXTURE_OPP_TEAM]];
          const venueRaw = row[h[CONFIG.HEADERS.FIXTURE_VENUE]];
          const dateDisplay = Utilities.formatDate(matchDate, Session.getScriptTimeZone(), 'd MMM (EEE)');

          // A. Internal List
          if (!matchesByDay[dateStr]) matchesByDay[dateStr] = [];
          matchesByDay[dateStr].push({
            day: Utilities.formatDate(matchDate, Session.getScriptTimeZone(), 'EEEE, d MMMM'),
            time: timeStr,
            ourTeam: ourTeam,
            homeAway: homeAway,
            opponent: `${oppClub} ${oppTeam}`
          });

          // B. Shuttle Logic
          let needsTube = (leagueCup === 'Cup') || (homeAway === 'Home' && leagueCup === 'League');
          if (needsTube) {
            matchTubesNeeded++;
            const captainName = (captainMap && captainMap[ourTeam.trim().toUpperCase()]) ? captainMap[ourTeam.trim().toUpperCase()] : 'N/A';
            const reason = (leagueCup === 'Cup') ? `Cup Match (${homeAway})` : 'Home League Match';
            shuttleAllocationDetails.push({ date: dateDisplay, team: ourTeam, captain: captainName, reason: reason });
          }

          // C. Opponent List
          if (oppClub && opponentContactMap[oppClub]) {
            if (!matchesByOpponent[oppClub]) matchesByOpponent[oppClub] = [];
            const theirLocation = (homeAway === 'Home') ? 'AWAY' : 'HOME';
            let displayVenue = venueRaw;
            if (!displayVenue || displayVenue === 'Away') {
                displayVenue = (theirLocation === 'HOME') ? 'Your Courts' : clubName;
            }
            matchesByOpponent[oppClub].push({
              date: dateDisplay, time: timeStr, location: theirLocation,
              theirTeam: oppTeam, ourTeam: ourTeam, venue: displayVenue
            });
          }
        }
      }
    }

    // --- 4. Send Internal Email ---
    const subjectDate = Utilities.formatDate(startOfNextWeek, Session.getScriptTimeZone(), 'd MMM');
    const rawSubject = `${clubName} Weekly Match Summary: Week of ${subjectDate}`;
    
    const internalTemplate = HtmlService.createTemplateFromFile(CONFIG.TEMPLATES.WEEKLY_SUMMARY);
    internalTemplate.clubName = clubName;
    internalTemplate.startDate = formatDate(startOfNextWeek);
    internalTemplate.endDate = formatDate(endOfNextWeek);
    internalTemplate.sortedDays = Object.keys(matchesByDay).sort();
    internalTemplate.matchesByDay = matchesByDay;
    internalTemplate.matchTubesNeeded = matchTubesNeeded;
    internalTemplate.shuttleAllocationDetails = shuttleAllocationDetails;

    const htmlBody = internalTemplate.evaluate().getContent();

    // Use the master helper
    const sentInfo = _sendClubEmail(clubEmail, rawSubject, htmlBody, settings);

    // Now you can log specifically
    console.log(`✅ Internal Summary sent to ${sentInfo.recipient}`);

    // --- 5. Send Opponent Courtesy Reminders ---
    let opponentsContacted = 0;
    for (const oppClub in matchesByOpponent) {
      const contactInfo = opponentContactMap[oppClub];
      if (!contactInfo || !contactInfo.email) continue;

      const matches = matchesByOpponent[oppClub];
      const oppTemplate = HtmlService.createTemplateFromFile(CONFIG.TEMPLATES.OPPONENT_REMINDER);
      oppTemplate.secretaryName = contactInfo.name;
      oppTemplate.opponentClubName = oppClub;
      oppTemplate.ourClubName = clubName;
      oppTemplate.matches = matches;

      const oppHtmlBody = oppTemplate.evaluate().getContent();
      const rawOppSubject = `${clubName} vs ${oppClub}: Upcoming Match Reminder`;

      // It automatically adds the "Reply-To" and "Sender Name" now!
      const oppSentInfo = _sendClubEmail(contactInfo.email, rawOppSubject, oppHtmlBody, settings);

      opponentsContacted++;

      // Now you can log the specific opponent name again!
      console.log(`📤 Sent reminder for ${oppClub} to ${oppSentInfo.recipient}`);
    }

    if (typeof logAction === 'function') {
       logAction('sendWeeklyMatchSummary', 'Sent Weekly Summaries', { }, `Internal Sent. Opponent Reminders Sent: ${opponentsContacted}`);
    }

  } catch (e) {
    console.log(`CRITICAL ERROR in sendWeeklyMatchSummary: ${e.message}\nStack: ${e.stack}`);
    const adminEmail = Session.getActiveUser().getEmail();
    if(adminEmail) {
      MailApp.sendEmail({ to: adminEmail, subject: "ERROR: Weekly Match Summary Failed", body: `Error: ${e.message}` });
    }
  }
}

/**
 * [CORE] The core "engine" that finds all matches for a given opponent,
 * constructs a summary email using an HTML template, and sends it.
 * 
 * @param {string} opponentName The exact name of the opponent club to summarize.
 */
function sendOpponentSummaryEmail(opponentName) {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  try {
    // --- 1. Get Opponent's Contact Info (UPDATED) ---
    // Use the shared helper (Single Source of Truth)
    const opponentContactMap = _buildOpponentContactMap(ss);
    const contactInfo = opponentContactMap[opponentName];
    
    if (!contactInfo || !contactInfo.email) {
       throw new Error(`Could not find a match secretary email for "${opponentName}" in the 'Opponent Info' sheet.`);
    }

    const secretaryEmail = contactInfo.email;
    const secretaryName = contactInfo.name || `the ${opponentName} Match Secretary`;

    // --- 2. Scan Fixtures and Collect All Relevant Matches ---
    const fixturesSheet = ss.getSheetByName(CONFIG.SHEETS.FIXTURES);
    const fixturesData = fixturesSheet.getDataRange().getValues();
    const h = findFixtureHeaders(fixturesData);

    if (!h) throw new Error("Could not find headers in Fixtures sheet.");

    const relevantMatches = [];

    for (let i = h.headerRowIndex + 1; i < fixturesData.length; i++) {
      const row = fixturesData[i];
      // We only care about rows where the opponent's name matches.
      if (row[h[CONFIG.HEADERS.FIXTURE_OPP_CLUB]] === opponentName) {

        // --- Definitive Resilient Date Handling Logic ---
        const rawDateString = row[h[CONFIG.HEADERS.FIXTURE_DATE]];
        let displayDate = 'TBC';
        let displayDay = 'TBC';
        let sortableDate = new Date('9999-12-31'); 

        if (rawDateString) {
          const matchDateObj = new Date(rawDateString);
          const isDateRange = /\d+-\d+/.test(rawDateString);
          const isInvalidDate = isNaN(matchDateObj.getTime());

          if (isDateRange || isInvalidDate) {
            displayDate = String(rawDateString).trim();
          } else {
            displayDate = Utilities.formatDate(matchDateObj, Session.getScriptTimeZone(), 'yyyy-MM-dd');
            displayDay = Utilities.formatDate(matchDateObj, Session.getScriptTimeZone(), 'EEEE');
            sortableDate = matchDateObj; 
          }
        }
        const matchTime = row[h[CONFIG.HEADERS.FIXTURE_TIME]] ? Utilities.formatDate(new Date(row[h[CONFIG.HEADERS.FIXTURE_TIME]]), Session.getScriptTimeZone(), 'HH:mm') : 'TBC';

        relevantMatches.push({
          date: displayDate,
          day: displayDay,
          sortableDate: sortableDate,
          time: matchTime,
          ourTeamNumber: row[h[CONFIG.HEADERS.FIXTURE_OUR_TEAM]] || '',
          theirTeamNumber: row[h[CONFIG.HEADERS.FIXTURE_OPP_TEAM]] || '',
          homeAway: row[h[CONFIG.HEADERS.FIXTURE_HOME_AWAY]] || '',
          venue: row[h[CONFIG.HEADERS.FIXTURE_VENUE]] || '',
          status: row[h[CONFIG.HEADERS.FIXTURE_STATUS]] || '',
          event: row[h[CONFIG.HEADERS.FIXTURE_EVENT]] || '',
          div: row[h[CONFIG.HEADERS.FIXTURE_DIV]] || '',
          sctn: row[h[CONFIG.HEADERS.FIXTURE_SCTN]] || '',
          leagueCup: row[h[CONFIG.HEADERS.FIXTURE_LEAGUE_CUP]] || ''
        });
      }
    }

    // Sort the matches
    relevantMatches.sort((a, b) => {
      const typeCompare = a.leagueCup.localeCompare(b.leagueCup);
      if (typeCompare !== 0) return typeCompare;
      const theirTeamCompare = a.theirTeamNumber.localeCompare(b.theirTeamNumber);
      if (theirTeamCompare !== 0) return theirTeamCompare;
      const ourTeamCompare = a.ourTeamNumber.localeCompare(b.ourTeamNumber);
      if (ourTeamCompare !== 0) return ourTeamCompare;
      const statusCompare = (b.homeAway === 'Away' ? 'Home' : 'Away').localeCompare(a.homeAway === 'Away' ? 'Home' : 'Away');
      if (statusCompare !== 0) return statusCompare;
      return a.sortableDate - b.sortableDate;
    });

    // --- 3. Prepare and Send the Email (UPDATED) ---
    const settings = getClubSettings_(); // Ensure we use the backend getter
    const ourClubName = settings['Club Name'] || 'Our Club';
    const originalSubject = `Match Summary: ${ourClubName} vs. ${opponentName}`;

    // Create HTML Body
    const emailTemplate = HtmlService.createTemplateFromFile(CONFIG.TEMPLATES.OPPONENT_SUMMARY);
    emailTemplate.ourClubName = ourClubName;
    emailTemplate.opponentClubName = opponentName;
    emailTemplate.secretaryName = secretaryName;
    emailTemplate.matches = relevantMatches;

    const htmlBody = emailTemplate.evaluate().getContent();

    // This automatically handles Branding, Reply-To, and Test Mode
    const sentInfo = _sendClubEmail(secretaryEmail, originalSubject, htmlBody, settings);

    // --- 4. Give User Confirmation ---
    // Use 'sentInfo.recipient' so the alert tells you exactly where it went (e.g., You vs Them)
    ui.alert('Success!', `A summary of all ${relevantMatches.length} matches has been sent to ${sentInfo.recipient}.`, ui.ButtonSet.OK);

  } catch (e) {
    console.log(`Error in sendOpponentSummaryEmail: ${e.message}`);
    ui.alert(`Error: ${e.message}`);
  }
}

//==============================================================
// HELPER FUNCTIONS
//==============================================================

/**
 * [HELPER] Helper for processSubmissions to process a single date.
 * Returns a status code:
 *  1: Success (U was added)
 *  0: No action taken (e.g., cell already 'U')
 * -1: Conflict (Admin Lock)
 * -2: Conflict (Match 'X') // We'll add this for future use, but won't use it yet
 * -3: Date Not Found in Grid
 * 
 * @param {Date} date The date object.
 * @param {number} col The column index.
 * @param {string} player The player name.
 * @param {string[]} conflictNotes Array to push notes to.
 * @param {Array[]} availData The availability data.
 * @param {Object} dateMap Map of dates to row indices.
 * @param {number} adminLockCol The admin lock column index.
 * @returns {number} Status code.
 */
function processDate(date, col, player, conflictNotes, availData, dateMap, adminLockCol) {
  const dStr = formatDateForSheet(date);
  const row = dateMap[dStr];

  if (!row) {
    // CRITICAL: The date does not exist in the Availability sheet's date column.
    return -3; 
  }

  if (adminLockCol !== -1 && availData[row][adminLockCol] !== '') {
    return -1; // Admin Lock conflict
  }

  const currentVal = availData[row][col].trim().toUpperCase();

  if (currentVal === '' || currentVal === 'R') {
    availData[row][col] = 'U';
    return 1; // Success
  } else if (currentVal === 'X') {
    const note = `Conflict (Match): Player is scheduled for a match ('X') on ${dStr}.`;
    conflictNotes.push(note);
    return 0; // Still return 0 as the 'note' is what matters here
  }
  
  // Date was found, but cell was already 'U' or some other non-empty value.
  // This is not an error, just no action needed.
  return 0;
}

/**
 * [HELPER] Takes a raw user input string and performs a multi-step cleaning process.
 * 1. Removes parenthetical notes.
 * 2. Standardizes all separators (comma, semicolon, newline) to a single newline.
 * 3. Splits the string into an array and filters out any empty entries.
 * 
 * @param {string} rawInput The messy input string from the form.
 * @returns {string[]} A clean array of date fragments to be processed.
 */
function _extractDateFragments(rawInput) {
  if (!rawInput) {
    return [];
  }

  // 1. Remove notes like (inclusive)
  let processedInput = rawInput.replace(/\(.*?\)/g, '');

  // 2. Standardize all separators to a newline character
  let standardizedInput = processedInput.replace(/[,;]/g, '\n');

  // 3. Split by the newline, trim whitespace from each part, and filter out empty strings
  const cleanFragments = standardizedInput.split('\n')
    .map(fragment => fragment.trim())
    .filter(fragment => fragment); // An empty string is "falsy", so it gets filtered out

  return cleanFragments;
}

/**
 * [HELPER] The "brain" of the sync process. Calculates the ideal state of the 
 * availability grid based on the Fixtures sheet.
 *
 * This function reads the fixtures and determines where 'X' (match) and 'R' (rest)
 * marks should be placed. It is also responsible for detecting two critical
 * types of scheduling conflicts during this calculation:
 * 
 * 1.  "U vs. X": A player is marked 'U' (Unavailable) on a day they are needed for a match.
 * 2.  "X vs. X": A player is scheduled for two different matches on the same day (double-booking).
 *
 * @param {Array<Array<string>>} fixturesData - The raw 2D data from the Fixtures sheet.
 * @param {Object} h - The headers map object from findFixtureHeaders().
 * @param {Object} teamMap - The map of teams to players.
 * @param {Object} playerColMap - The map of player names to column indices.
 * @param {Object} dateRowMap - The map of date strings to row indices.
 * @param {Array<Array<string>>} availData - The raw 2D data from the Availability sheet.
 * @param {string} clubName - The name of the home club from Settings.
 * @param {number} bufferDays - The number of rest days to apply around a match.
 * @returns {{required: Object, uVsXConflicts: Array, doubleBookingConflicts: Array}} 
 *          An object containing:
 *          - `required`: A map of the ideal state of the grid (e.g., {'3-4': 'X'}).
 *          - `uVsXConflicts`: An array of objects detailing "Unavailable vs. Match" conflicts.
 *          - `doubleBookingConflicts`: An array of objects detailing double-booking conflicts.
 */
function _calculateRequiredMarks(fixturesData, h, teamMap, playerColMap, dateRowMap, availData, clubName, bufferDays) {
  
  const requiredMap = {}; // The map of what the grid SHOULD look like.
  const uVsXConflicts = []; // To hold "Unavailable vs. Match" conflicts.
  const doubleBookingConflicts = []; // To hold "Match vs. Match" conflicts.

  for (let i = h.headerRowIndex + 1; i < fixturesData.length; i++) {
    const row = fixturesData[i];
    const team = row[h['Team No.']];
    const club = row[h['Your Club']];
    const dateVal = row[h['Date']];
    const status = row[h['Match Status']];

    if (club !== clubName || !team || status !== CONFIG.STATUSES.CONFIRMED || !dateVal || isNaN(new Date(dateVal).getTime())) {
      continue;
    }

    const players = teamMap[team.trim().toUpperCase()];
    if (!players) continue;

    const date = new Date(dateVal);
    const dStr = formatDateForSheet(date);
    const rIdx = dateRowMap[dStr];
    if (!rIdx) continue;

    for (const p of players) {
      const cIdx = playerColMap[p.trim().toUpperCase()];
      if (cIdx) {
        // --- CORE LOGIC: CHECK FOR CONFLICTS BEFORE MARKING ---
        const cellKey = `${rIdx}-${cIdx}`;
        const currentMarkInGrid = availData[rIdx][cIdx].trim().toUpperCase();
        
        // Check 1: Is the player already marked as Unavailable?
        if (currentMarkInGrid === 'U') {
          uVsXConflicts.push({
            date: dStr, player: p, team: team,
            opponent: `${row[h['Opposition Club']]} ${row[h['Opp Team No.']]}`
          });
          continue; // Veto power: Do not schedule this match for this player.
        }
        
        // Check 2: Have we ALREADY scheduled a match for this player on this day *during this sync*?
        if (requiredMap[cellKey] === 'X') {
          // This is a true double-booking conflict.
          doubleBookingConflicts.push({
            date: dStr, player: p, team: team,
            opponent: `${row[h['Opposition Club']]} ${row[h['Opp Team No.']]}`
          });
          // We still continue, because the first 'X' will be applied.
        }

        // If no conflicts, proceed with marking the 'X' and 'R's as normal.
        requiredMap[cellKey] = 'X';
        
        for (let d = -bufferDays; d <= bufferDays; d++) {
          if (d === 0) continue;
          const buf = new Date(date);
          buf.setDate(buf.getDate() + d);
          const bStr = formatDateForSheet(buf);
          const bIdx = dateRowMap[bStr];
          if (bIdx && !requiredMap[`${bIdx}-${cIdx}`]) {
            requiredMap[`${bIdx}-${cIdx}`] = 'R';
          }
        }
      }
    }
  }
  
  // Return the required marks and BOTH lists of conflicts
  return { 
    required: requiredMap, 
    uVsXConflicts: uVsXConflicts,
    doubleBookingConflicts: doubleBookingConflicts
  };
}

/**
 * [HELPER] The "worker" of the sync. Compares the desired state with the current
 * state of the grid and writes only the necessary changes.
 *
 * @param {Sheet} availabilitySheet - The Sheet object for 'Availability'.
 * @param {Array[][]} availData - The current 2D data from the grid.
 * @param {Object} required - The map of required marks from _calculateRequiredMarks().
 * @param {Object} playerColMap - The map of player names to column indices.
 * @returns {{addedX: number, addedR: number, removedX: number, removedR: number}} An object detailing the changes made.
 */
function _applyAvailabilityChanges(availabilitySheet, availData, required, playerColMap) {
  let addedX = 0, addedR = 0, removedX = 0, removedR = 0;
  
  // Create a mutable copy of the data that we can change in memory.
  const newData = availData.map(r => [...r]);
  const adminLockCol = playerColMap[CONFIG.HEADERS.ADMIN_LOCK.toUpperCase()] ?? -1;

  // Loop through every cell in the grid to see if a change is needed.
  // Start at row 1 and col 1 to skip headers and date column.
  for (let r = 1; r < availData.length; r++) {
    for (let c = 1; c < availData[r].length; c++) {
      // Skip the admin lock column, as it should never be changed by this script.
      if (c === adminLockCol) continue;

      const key = `${r}-${c}`;
      const requiredMark = required[key]; // The mark this cell SHOULD have (e.g., "X", "R", or undefined)
      const currentMark = availData[r][c];  // The mark this cell CURRENTLY has

      // IMPORTANT: If a player has marked themselves as 'U', we NEVER overwrite it.
      if (currentMark.trim().toUpperCase() === 'U') {
        continue;
      }

      // --- The "Delta" Logic ---
      if (requiredMark && !currentMark) {
        // CASE 1: Cell is empty, but we need a mark.
        newData[r][c] = requiredMark;
        if (requiredMark === 'X') addedX++; else addedR++;
      } else if (!requiredMark && (currentMark === 'X' || currentMark === 'R')) {
        // CASE 2: Cell has a mark, but we no longer need one.
        newData[r][c] = '';
        if (currentMark === 'X') removedX++; else removedR++;
      } else if (requiredMark === 'X' && currentMark === 'R') {
        // CASE 3 (Edge Case): Cell has a buffer 'R', but now needs to be an 'X'. 'X' always wins.
        newData[r][c] = 'X';
        addedX++;
        removedR++;
      }
    }
  }

  // Write all the accumulated changes back to the sheet in a single, efficient operation.
  availabilitySheet.getDataRange().setValues(newData);

  return { addedX, addedR, removedX, removedR };
}

/**
 * [HELPER] Displays a final confirmation dialog with a consistent
 * "Checklist" format. It automatically replaces the "Processing..." spinner.
 * @param {string} title The title of the dialog box (e.g., "HOME Match Confirmed!").
 * @param {string} matchInfo A single line describing the match (e.g., "Team A vs Team B on [Date]").
 * @param {string} actions A multi-line string of checklist items (e.g., "✔ Action 1\n✔ Action 2").
 */
function showFinalDialog(title, matchInfo, actions) {
  // Split the actions string into an array of individual action lines
  const actionItems = actions.split('\n');

  // Build the HTML for the checklist, wrapping each item in a paragraph tag
  let actionsHtml = '';
  actionItems.forEach(item => {
    actionsHtml += `<p style="margin: 5px 0;">${item}</p>`;
  });

  // Assemble the final, structured HTML content
  const finalHtml = `
    <div style="font-family: Arial, sans-serif; padding: 10px;">
      <p style="text-align: center; font-weight: bold; margin-bottom: 15px; font-size: 1.1em;">${matchInfo}</p>
      <div style="text-align: left; padding-left: 10px;">
        ${actionsHtml}
      </div>
    </div>`;

  const htmlOutput = HtmlService.createHtmlOutput(finalHtml)
    .setWidth(450)  // Slightly wider to prevent awkward wrapping
    .setHeight(230); // Slightly taller
    
  SpreadsheetApp.getUi().showModalDialog(htmlOutput, title);
}

/**
 * [HELPER] Normalizes booking data from either the Home or Away sheet.
 * This abstracts away the header differences between the two sheets.
 * 
 * @param {Sheet} sheet The sheet object (Booking Requests or Away Match Proposals).
 * @param {Array} rowData The array of values for the specific row.
 * @param {boolean} isHome True if this is a Home booking request.
 * @returns {Object} Normalized data object.
 */
function _extractBookingData(sheet, rowData, isHome) {
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0].map(h => h.trim());
  const h = {};
  headers.forEach((header, i) => { h[header] = i; });

  // Common fields with potentially different header names
  const data = {
    opponentClub: isHome ? rowData[h['Requesting Club']] : rowData[h['Opponent Club']],
    opponentTeam: rowData[h['Their Team']],
    ourTeam: isHome ? rowData[h['Your Team']] : rowData[h['Our Team']],
    email: rowData[h['Contact Email']],
    matchType: rowData[h['Match Type']],
    proposedDate: rowData[h['Proposed Date']],
    proposedTime: rowData[h['Proposed Time']],
    venue: isHome ? null : rowData[h['Venue']] // Venue only explicitly in Away sheet
  };

  // Derived fields
  data.matchDate = new Date(data.proposedDate);
  if (isNaN(data.matchDate.getTime())) {
    throw new Error("Invalid Date. Please correct the date and try again.");
  }
  data.formattedTime = formatTimeFromSheet(data.proposedTime);
  data.formattedDay = Utilities.formatDate(data.matchDate, Session.getScriptTimeZone(), 'EEEE');
  data.dateStr = formatDateForSheet(data.matchDate);

  return data;
}

/**
 * [CORE] Unified processor for all booking status changes.
 * Handles Confirm, Cancel, and Reject for both Home and Away matches.
 * 
 * @param {Object} e The event object from onEdit.
 * @param {string} action The action to perform ('confirmed', 'cancelled', 'rejected').
 * @param {boolean} isHome True if this is a Home booking request.
 */
function _processBookingChange(e, action, isHome) {
  const ui = SpreadsheetApp.getUi();
  const range = e.range;
  const oldValue = e.oldValue;
  const sheet = range.getSheet();
  const row = range.getRow();

  try {
    // --- 1. GET & NORMALIZE DATA ---
    const allData = sheet.getDataRange().getValues();
    const rowData = allData[row - 1];
    const data = _extractBookingData(sheet, rowData, isHome);

    // --- 2. GET SETTINGS ---
    const settings = getClubSettings_();
    const ourClubName = settings['Club Name'] || 'Match Secretary';

    // --- 3. EXECUTE ACTION ---
    let emailInfo = {};
    let fixtureUpdated = false;
    let availabilityStats = { addedX: 0, addedR: 0, removedX: 0, removedR: 0 };
    let successTitle = "";
    let successActions = [];

    if (action === 'confirmed') {
      // --- VALIDATE ---
      _validateProposal(data.ourTeam, data.matchDate, isHome, settings);

      // --- UPDATE FIXTURE ---
      const fixturesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.FIXTURES);
      if (!fixturesSheet) throw new Error("'Fixtures' sheet not found.");
      const fixturesData = fixturesSheet.getDataRange().getValues();
      const fx_h = findFixtureHeaders(fixturesData);
      if (!fx_h) throw new Error("Could not find headers in 'Fixtures' sheet.");

      let foundRowIndex = -1;
      let division = '', event = '', sctn = '';

      // Find the matching fixture
      for (let i = fx_h.headerRowIndex + 1; i < fixturesData.length; i++) {
        const fRow = fixturesData[i];
        // Common checks
        if (fRow[fx_h['Team No.']] !== data.ourTeam) continue;
        if (fRow[fx_h['Match Status']] !== CONFIG.STATUSES.NOT_CONFIRMED) continue;

        // Home/Away specific checks
        if (isHome) {
          if (fRow[fx_h['Home / Away']] === 'Home' &&
            fRow[fx_h['Opposition Club']] === data.opponentClub &&
            fRow[fx_h['Opp Team No.']] === data.opponentTeam) {
            foundRowIndex = i;
            sctn = fRow[fx_h['Sctn']];
            division = fRow[fx_h['Div']];
            event = fRow[fx_h['Event']] || _getEventFromTeamName(data.ourTeam);
            break;
          }
        } else {
          if (fRow[fx_h['Home / Away']] === 'Away' &&
            fRow[fx_h['Opposition Club']] === data.opponentClub &&
            fRow[fx_h['Opp Team No.']] === data.opponentTeam) {
            foundRowIndex = i;
            // For Away matches, we grab existing details from the sheet
            sctn = fRow[fx_h['Sctn']];
            division = fRow[fx_h['Div']];
            event = fRow[fx_h['Event']];
            break;
          }
        }
      }

      if (foundRowIndex !== -1) {
        // Update existing row
        const sheetRow = foundRowIndex + 1;
        const rowRange = fixturesSheet.getRange(sheetRow, 1, 1, fixturesSheet.getLastColumn());
        const existing_fx_rowData = rowRange.getValues()[0];

        existing_fx_rowData[fx_h['Date']] = data.matchDate;
        existing_fx_rowData[fx_h['Day']] = data.formattedDay;
        existing_fx_rowData[fx_h['Time']] = data.formattedTime;
        existing_fx_rowData[fx_h['Match Status']] = 'Confirmed';
        existing_fx_rowData[fx_h['Venue / Hall']] = isHome ? (settings[_getDaySettingKey(data.matchDate.getDay(), 'Venue')] || ourClubName) : data.venue;
        existing_fx_rowData[fx_h['League / Cup']] = data.matchType;

        // Only update these if we found them (Home flow might need to look them up if creating new)
        if (event) existing_fx_rowData[fx_h['Event']] = event;
        if (division) existing_fx_rowData[fx_h['Div']] = division;

        rowRange.setValues([existing_fx_rowData]);
        fixtureUpdated = true;
      } else if (isHome) {
        // Create NEW row (Only for Home matches)
        division = division || _getDivisionFromTeamName(sheet.getParent(), data.ourTeam);
        event = event || _getEventFromTeamName(data.ourTeam);
        const venueName = settings[_getDaySettingKey(data.matchDate.getDay(), 'Venue')] || ourClubName;

        let newRow = new Array(fx_h.headerRowIndex > -1 ? fixturesData[fx_h.headerRowIndex].length : 15).fill('');
        newRow[fx_h['Date']] = data.matchDate;
        newRow[fx_h['Day']] = data.formattedDay;
        newRow[fx_h['Time']] = data.formattedTime;
        newRow[fx_h['Event']] = event;
        newRow[fx_h['Div']] = division;
        newRow[fx_h['League / Cup']] = data.matchType;
        newRow[fx_h['Your Club']] = ourClubName;
        newRow[fx_h['Team No.']] = data.ourTeam;
        newRow[fx_h['Home / Away']] = 'Home';
        newRow[fx_h['Opposition Club']] = data.opponentClub;
        newRow[fx_h['Opp Team No.']] = data.opponentTeam;
        newRow[fx_h['Venue / Hall']] = venueName;
        newRow[fx_h['Match Status']] = 'Confirmed';

        fixturesSheet.appendRow(newRow);
        fixtureUpdated = true;
      } else {
        throw new Error('Could not find a corresponding "Not confirmed" AWAY fixture to update.');
      }

      // --- SEND EMAIL ---
      const templateName = isHome ? 'ConfirmationEmail.html' : 'AwayConfirmationEmail.html';
      const emailTemplate = HtmlService.createTemplateFromFile(templateName);
      emailTemplate.opponentClubName = data.opponentClub;
      emailTemplate.opponentTeamName = data.opponentTeam;
      emailTemplate.ourClubName = ourClubName;
      emailTemplate.ourTeamNumber = data.ourTeam;
      emailTemplate.event = event || '';
      emailTemplate.division = division || '';
      emailTemplate.sctn = sctn || '';
      emailTemplate.matchType = data.matchType;
      emailTemplate.formattedDate = formatDate(data.matchDate);
      emailTemplate.formattedTime = data.formattedTime;
      emailTemplate.venueName = isHome ? (settings[_getDaySettingKey(data.matchDate.getDay(), 'Venue')] || ourClubName) : data.venue;
      emailTemplate.formattedShortDate = Utilities.formatDate(data.matchDate, Session.getScriptTimeZone(), 'd MMM yyyy');
      emailTemplate.formattedDay = data.formattedDay;

      const htmlBody = emailTemplate.evaluate().getContent();
      const plainBody = htmlBody.replace(/<[^>]+>/g, '');

      const subject = `Match Confirmed: ${data.opponentClub} ${data.opponentTeam} (${isHome ? 'Your AWAY' : 'Your HOME'} Match) vs ${ourClubName} ${data.ourTeam} on ${data.dateStr}`;
      emailInfo = _sendClubEmail(data.email, subject, htmlBody, settings, plainBody);

      successTitle = `${isHome ? 'HOME' : 'AWAY'} Match Confirmed!`;
      successActions.push(fixtureUpdated ? `✔ Fixture sheet updated.` : `⚠ Fixture not found/updated.`);
      successActions.push(`✔ Email sent to ${emailInfo.recipient}.`);

    } else if (action === 'cancelled') {
      // --- REVERT FIXTURE ---
      const fixturesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.FIXTURES);
      if (!fixturesSheet) throw new Error("'Fixtures' sheet not found.");
      const fixturesData = fixturesSheet.getDataRange().getValues();
      const fx_h = findFixtureHeaders(fixturesData);
      if (!fx_h) throw new Error("Could not find headers in 'Fixtures' sheet.");

      let foundRowIndex = -1;
      const isInternalMatch = (ourClubName === data.opponentClub);

      for (let i = fx_h.headerRowIndex + 1; i < fixturesData.length; i++) {
        const fRow = fixturesData[i];
        const fRowDateStr = fRow[fx_h['Date']] ? formatDateForSheet(new Date(fRow[fx_h['Date']])) : null;

        if (fRow[fx_h['Team No.']] === data.ourTeam &&
          fRowDateStr === data.dateStr &&
          fRow[fx_h['Match Status']] === 'Confirmed') {

          if (isHome) {
            if (fRow[fx_h['Home / Away']] === 'Home') {
              if (isInternalMatch) {
                if (fRow[fx_h['Opp Team No.']] === data.opponentTeam) foundRowIndex = i;
              } else {
                if (fRow[fx_h['Opposition Club']] === data.opponentClub) foundRowIndex = i;
              }
            }
          } else {
            // Away Logic
            if (fRow[fx_h['Home / Away']] === 'Away' &&
              fRow[fx_h['Opposition Club']] === data.opponentClub &&
              fRow[fx_h['Opp Team No.']] === data.opponentTeam) {
              foundRowIndex = i;
            }
          }
        }
        if (foundRowIndex !== -1) break;
      }

      if (foundRowIndex !== -1) {
        const sheetRow = foundRowIndex + 1;
        const rowRange = fixturesSheet.getRange(sheetRow, 1, 1, fixturesSheet.getLastColumn());
        const existing_fx_rowData = rowRange.getValues()[0];
        existing_fx_rowData[fx_h['Match Status']] = CONFIG.STATUSES.NOT_CONFIRMED;
        existing_fx_rowData[fx_h['Date']] = '';
        existing_fx_rowData[fx_h['Day']] = '';
        existing_fx_rowData[fx_h['Time']] = '';
        existing_fx_rowData[fx_h['Venue / Hall']] = '';
        rowRange.setValues([existing_fx_rowData]);
        fixtureUpdated = true;
      }

      // --- SEND EMAIL ---
      const templateName = isHome ? 'CancellationEmail.html' : 'AwayCancellationEmail.html';
      const emailTemplate = HtmlService.createTemplateFromFile(templateName);
      emailTemplate.webAppUrl = settings['Web App URL'];
      emailTemplate.opponentClubName = data.opponentClub;
      emailTemplate.opponentTeamName = data.opponentTeam;
      emailTemplate.ourClubName = ourClubName;
      emailTemplate.ourTeamNumber = data.ourTeam;
      emailTemplate.matchType = data.matchType;
      emailTemplate.formattedDate = formatDate(data.matchDate);
      emailTemplate.formattedTime = data.formattedTime;
      emailTemplate.venueName = isHome ? (settings[_getDaySettingKey(data.matchDate.getDay(), 'Venue')] || ourClubName) : data.venue;

      const htmlBody = emailTemplate.evaluate().getContent();
      const plainBody = htmlBody.replace(/<[^>]+>/g, '');

      const subject = `Match CANCELLED: ${data.opponentClub} ${data.opponentTeam} (${isHome ? 'Your AWAY' : 'Your HOME'} Match) vs ${ourClubName} ${data.ourTeam} on ${data.dateStr}`;
      emailInfo = _sendClubEmail(data.email, subject, htmlBody, settings, plainBody);

      successTitle = `${isHome ? 'HOME' : 'AWAY'} Match Cancelled!`;
      successActions.push(fixtureUpdated ? `✔ Fixture status reset.` : `⚠ Fixture not found/reset.`);
      successActions.push(`✔ Email sent to ${emailInfo.recipient}.`);

    } else if (action === 'rejected') {
      // --- SEND REJECTION EMAIL ---
      emailInfo = _sendRejectionEmail(
        isHome,
        data.opponentClub,
        data.opponentTeam,
        data.ourTeam,
        data.email,
        data.matchDate,
        data.proposedTime,
        data.venue
      );
      successTitle = `${isHome ? 'HOME' : 'AWAY'} Request Rejected!`;
      successActions.push(`✔ Rejection email sent to ${emailInfo.recipient}.`);
    }

    // --- 4. SYNC AVAILABILITY (If not rejected) ---
    if (action !== 'rejected') {
      const fillResult = fillAvailabilityX(true); // Silent mode
      if (fillResult) {
        availabilityStats = fillResult;
        const xCount = action === 'confirmed' ? fillResult.addedX : fillResult.removedX;
        const rCount = action === 'confirmed' ? fillResult.addedR : fillResult.removedR;
        const actionVerb = action === 'confirmed' ? 'Added' : 'Removed';
        successActions.push(`✔ Availability synced (${actionVerb} ${xCount} 'X' & ${rCount} 'R').`);
      }
    }

    // --- 5. COMMIT STATUS & SHOW DIALOG ---
    range.setValue(action.charAt(0).toUpperCase() + action.slice(1)); // Capitalize

    const matchInfo = `${ourClubName} ${data.ourTeam} vs ${data.opponentClub} ${data.opponentTeam}`;
    showFinalDialog(successTitle, matchInfo, successActions.join('\n'));

  } catch (err) {
    ui.alert(`A critical error occurred: ${err.message}`);
    console.log(`CRITICAL ERROR in _processBookingChange: ${err.message}\nStack: ${err.stack}`);
    if (range) range.setValue(oldValue || "Error");
  }
}
