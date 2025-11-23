/*******************************************************************
 * Match Admin System: Spreadsheet Administration & Triggers
 *
 * This file contains all functions that are executed from the
 * Google Sheet interface, either via the custom "Match Admin" menu
 * or by automated triggers like `onEdit`.
 *******************************************************************/
//==============================================================
// 3️⃣ SPREADSHEET - ADMIN & TRIGGERS
//==============================================================

//==============================================================
//--- MAIN onEdit TRIGGER ---//
//==============================================================

/**
 * [TRIGGER] The main onEdit trigger handler.
 * Listens for changes in the "Booking Requests" and "Away Match Proposals" sheets.
 * If the "Status" column is changed to "Confirmed", "Cancelled", or "Rejected",
 * it triggers the appropriate processing function.
 * 
 * @param {Object} e The event object from the onEdit trigger.
 */
function handleConfirmationEdit(e) {
  const ss = e.source;
  const sheet = ss.getActiveSheet();

  // Ignore edits to the header row or non-status columns
  if (e.range.getRow() <= 1) return;
  const headerName = sheet.getRange(1, e.range.getColumn()).getValue();
  if (headerName !== CONFIG.HEADERS.STATUS) return;

  // If the cell was cleared, do nothing.
  if (!e.value) {
    return;
  }

  const newValue = e.value.toLowerCase();
  const actionableStatuses = ['confirmed', 'cancelled', 'rejected'];

  // 1. First, check if the new status is one we actually care about.
  if (actionableStatuses.includes(newValue)) {
    
    // 2. If it is, NOW we lock the UI.
    const ui = SpreadsheetApp.getUi();
    const htmlOutput = HtmlService.createHtmlOutputFromFile('LoadingSpinner')
      .setWidth(250)
      .setHeight(150);
    ui.showModalDialog(htmlOutput, 'Processing...');
    SpreadsheetApp.flush();

    // 3. And finally, route to the correct processing function.
    const sheetName = sheet.getName();
    if (sheetName === CONFIG.SHEETS.BOOKING_REQUESTS) {
      if (newValue === 'confirmed') { processConfirmedBooking(e, ui); } 
      else if (newValue === 'cancelled') { processCancelledBooking(e, ui); } 
      else if (newValue === 'rejected') { processRejectedBooking(e, ui); }
    } 
    else if (sheetName === CONFIG.SHEETS.AWAY_MATCH_PROPOSALS) {
      if (newValue === 'confirmed') { processConfirmedAwayBooking(e, ui); } 
      else if (newValue === 'cancelled') { processCancelledAwayBooking(e, ui); } 
      else if (newValue === 'rejected') { processRejectedAwayBooking(e, ui); }
    }
  }
  // If the newValue is 'pending' or anything else, the function simply ends here.
}

//==============================================================
//--- HOME BOOKING HANDLERS ---//
//==============================================================

/**
 * [CORE] Processes a "Confirmed" status for a HOME booking request.
 * (Called by handleConfirmationEdit)
 * 
 * @param {Object} e The event object.
 * @param {Object} ui The Spreadsheet UI object.
 */
function processConfirmedBooking(e, ui) {
  const range = e.range;
  const oldValue = e.oldValue;
  try {
    // --- 1. GET INITIAL DATA ---
    const sheet = range.getSheet();
    const ss = sheet.getParent();
    const row = range.getRow();
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0].map(h => h.trim());
    const rowData = allData[row - 1];
    const h = {};
    headers.forEach((header, i) => { h[header] = i; });

    const opponentClubName = rowData[h['Requesting Club']];
    const opponentTeamName = rowData[h['Their Team']];
    const ourTeamNumber = rowData[h['Your Team']];
    const opponentEmail = rowData[h['Contact Email']];
    const matchType = rowData[h['Match Type']];
    const proposedDate = rowData[h['Proposed Date']];
    const proposedTime = rowData[h['Proposed Time']];
    const matchDate = new Date(proposedDate);

    if (isNaN(matchDate.getTime())) {
      throw new Error("Invalid Date. Please correct the date and try again.");
    }
    
    // --- 2. VALIDATE THE PROPOSAL ---
    // Correctly set to 'true' for a HOME match.
    _validateProposal(ourTeamNumber, matchDate, true); 

    // --- 3. GET VENUE AND TEAM INFO & UPDATE FIXTURES ---
    const settings = getClubSettings();
    const ourClubName = settings['Club Name'] || 'Match Secretary';
    const formattedTime = formatTimeFromSheet(proposedTime);
    const formattedDay = Utilities.formatDate(matchDate, Session.getScriptTimeZone(), 'EEEE');
    const venueKey = _getDaySettingKey(matchDate.getDay(), 'Venue');
    const venueName = settings[venueKey] || ourClubName;

    const fixturesSheet = ss.getSheetByName(CONFIG.SHEETS.FIXTURES);
    if (!fixturesSheet) throw new Error("'Fixtures' sheet not found.");
    const fixturesData = fixturesSheet.getDataRange().getValues();
    const fx_h = findFixtureHeaders(fixturesData);
    if (!fx_h) throw new Error("Could not find headers in 'Fixtures' sheet.");

    let fixtureUpdated = false;
    let sctn = '', division = '', event = '';
    let foundRowIndex = -1;

    // Correctly searching for a 'Home' match.
    for (let i = fx_h.headerRowIndex + 1; i < fixturesData.length; i++) {
        const fRow = fixturesData[i];
        if (fRow[fx_h['Home / Away']] === 'Home' && fRow[fx_h['Team No.']] === ourTeamNumber && fRow[fx_h['Opposition Club']] === opponentClubName && fRow[fx_h['Opp Team No.']] === opponentTeamName && fRow[fx_h['Match Status']] === 'Not confirmed') {
            foundRowIndex = i;
            sctn = fRow[fx_h['Sctn']];
            division = fRow[fx_h['Div']];
            event = fRow[fx_h['Event']] || _getEventFromTeamName(ourTeamNumber);
            break;
        }
    }

    if (foundRowIndex !== -1) {
        // --- Scenario 1: Update an existing "Not confirmed" fixture ---
        const sheetRow = foundRowIndex + 1;
        const rowRange = fixturesSheet.getRange(sheetRow, 1, 1, fixturesSheet.getLastColumn());
        const existing_fx_rowData = rowRange.getValues()[0];
        
        existing_fx_rowData[fx_h['Date']] = matchDate;
        existing_fx_rowData[fx_h['Day']] = formattedDay;
        existing_fx_rowData[fx_h['Time']] = formattedTime;
        existing_fx_rowData[fx_h['Match Status']] = 'Confirmed';
        existing_fx_rowData[fx_h['Venue / Hall']] = venueName;
        existing_fx_rowData[fx_h['Event']] = event;
        existing_fx_rowData[fx_h['Div']] = division;
        existing_fx_rowData[fx_h['League / Cup']] = matchType;
        
        rowRange.setValues([existing_fx_rowData]);
        Logger.log(`Updated existing Fixtures row: ${sheetRow}`);
        fixtureUpdated = true;

    } else {
        // --- Scenario 2: Append a new fixture row ---
        Logger.log(`No existing "Not confirmed" match found. Appending new row.`);
        let newRow = new Array(fx_h.headerRowIndex > -1 ? fixturesData[fx_h.headerRowIndex].length : 15).fill('');
        
        // Ensure we have the division and event, looking it up if necessary
        division = division || _getDivisionFromTeamName(ss, ourTeamNumber);
        event = event || _getEventFromTeamName(ourTeamNumber);
        
        newRow[fx_h['Date']] = matchDate;
        newRow[fx_h['Day']] = formattedDay;
        newRow[fx_h['Time']] = formattedTime;
        newRow[fx_h['Event']] = event;
        newRow[fx_h['Div']] = division;
        newRow[fx_h['League / Cup']] = matchType;
        newRow[fx_h['Your Club']] = ourClubName;
        newRow[fx_h['Team No.']] = ourTeamNumber;
        newRow[fx_h['Home / Away']] = 'Home';
        newRow[fx_h['Opposition Club']] = opponentClubName;
        newRow[fx_h['Opp Team No.']] = opponentTeamName;
        newRow[fx_h['Venue / Hall']] = venueName;
        newRow[fx_h['Match Status']] = 'Confirmed';
        
        fixturesSheet.appendRow(newRow);
        fixtureUpdated = true;
    }

    // --- 4. SEND CONFIRMATION EMAIL ---
    const dateStr = formatDateForSheet(matchDate);

    // --- Use the Centralized Test Mode Helper ---
    const originalSubject = `Match Confirmed: ${opponentClubName} ${opponentTeamName} (Your AWAY Match) vs ${ourClubName} on ${dateStr}`;
    
    const emailTemplate = HtmlService.createTemplateFromFile('ConfirmationEmail.html');
    emailTemplate.opponentClubName = opponentClubName;
    emailTemplate.opponentTeamName = opponentTeamName;
    emailTemplate.ourClubName = ourClubName;
    emailTemplate.ourTeamNumber = ourTeamNumber;
    emailTemplate.event = event || '';
    emailTemplate.division = division || '';
    emailTemplate.sctn = sctn || '';
    emailTemplate.matchType = matchType;
    emailTemplate.formattedDate = formatDate(matchDate);
    emailTemplate.formattedTime = formattedTime;
    emailTemplate.venueName = venueName;
    emailTemplate.formattedShortDate = Utilities.formatDate(matchDate, Session.getScriptTimeZone(), 'd MMM yyyy');
    emailTemplate.formattedDay = formattedDay;
    const htmlBody = emailTemplate.evaluate().getContent();
    const plainBody = htmlBody.replace(/<[^>]+>/g, '');
    
    // Use centralized helper
    const emailInfo = _sendClubEmail(opponentEmail, originalSubject, htmlBody, settings, plainBody);

    // --- 5. SYNC AVAILABILITY ---
    const fillResult = fillAvailabilityX();
    const addedX = fillResult ? fillResult.addedX : 0;
    const addedR = fillResult ? fillResult.addedR : 0;

    // --- 6. COMMIT THE FINAL STATUS CHANGE ---
    range.setValue('Confirmed');
    
    // --- 7. SHOW THE FINAL SUCCESS DIALOG ---
    const successTitle = "HOME Match Confirmed!";
    const matchInfo = `${ourClubName} ${ourTeamNumber} vs ${opponentClubName} ${opponentTeamName}`;
    const actions = [
      fixtureUpdated ? `✔ Fixture sheet updated.` : `⚠ Fixture not found/updated.`,
      `✔ Email sent to ${emailInfo.recipient}.`,
      `✔ Availability synced (Added ${addedX} 'X' & ${addedR} 'R').`
    ];
    showFinalDialog(successTitle, matchInfo, actions.join('\n'));

  } catch (err) {
    // If any error occurs (e.g., email fails), it's caught here.
    ui.alert(`A critical error occurred: ${err.message}`);
    Logger.log(`CRITICAL ERROR in processConfirmedBooking: ${err.message}\nStack: ${err.stack}`);
    if(range) range.setValue(oldValue || "Error");
  }
}

/**
 * [CORE] Processes a "Cancelled" status for a HOME booking request.
 * (Called by handleConfirmationEdit)
 * 
 * @param {Object} e The event object.
 * @param {Object} ui The Spreadsheet UI object.
 */
function processCancelledBooking(e, ui) {
  const range = e.range;
  const oldValue = e.oldValue;
  try {
    // --- 1. GET INITIAL DATA ---
    const sheet = range.getSheet();
    const ss = sheet.getParent();
    const row = range.getRow();
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0].map(h => h.trim());
    const rowData = allData[row - 1];
    const h = {};
    headers.forEach((header, i) => { h[header] = i; });

    const opponentClubName = rowData[h['Requesting Club']];
    const opponentTeamName = rowData[h['Their Team']];
    const ourTeamNumber = rowData[h['Your Team']];
    const opponentEmail = rowData[h['Contact Email']];
    const matchType = rowData[h['Match Type']];
    const proposedDate = rowData[h['Proposed Date']];
    const proposedTime = rowData[h['Proposed Time']];
    const matchDate = new Date(proposedDate);

    if (isNaN(matchDate.getTime())) {
      throw new Error("Invalid Date. Please correct the date and try again.");
    }
    
    // --- 2. FIND & REVERT FIXTURE ---
    let fixtureUpdated = false;
    const settings = getClubSettings();
    const ourClubName = settings['Club Name'] || 'Match Secretary';
    const fixturesSheet = ss.getSheetByName(CONFIG.SHEETS.FIXTURES);
    if (!fixturesSheet) throw new Error("'Fixtures' sheet not found.");
    
    const fixturesData = fixturesSheet.getDataRange().getValues();
    const fx_h = findFixtureHeaders(fixturesData);
    if (!fx_h) throw new Error("Could not find headers in 'Fixtures' sheet.");

    const isInternalMatch = (ourClubName === opponentClubName);
    for (let i = fx_h.headerRowIndex + 1; i < fixturesData.length; i++) {
      const fRow = fixturesData[i];
      const fRowDateStr = fRow[fx_h['Date']] ? formatDateForSheet(new Date(fRow[fx_h['Date']])) : null;

      let isTheMatch = false;
      if (fRow[fx_h['Home / Away']] === 'Home' && fRow[fx_h['Team No.']] === ourTeamNumber && fRowDateStr === formatDateForSheet(matchDate) && fRow[fx_h['Match Status']] === 'Confirmed') {
          if (isInternalMatch) {
              // For an internal match, just check the opponent's team number.
              if (fRow[fx_h['Opp Team No.']] === opponentTeamName) {
                  isTheMatch = true;
              }
          } else {
              // For a normal external match, check the opponent's club name.
              if (fRow[fx_h['Opposition Club']] === opponentClubName) {
                  isTheMatch = true;
              }
          }
      }

        if (isTheMatch) {
          // We found it. Revert it.
          const sheetRow = i + 1;
          const rowRange = fixturesSheet.getRange(sheetRow, 1, 1, fixturesSheet.getLastColumn());
          const existing_fx_rowData = rowRange.getValues()[0];
          existing_fx_rowData[fx_h['Match Status']] = 'Not confirmed';
          existing_fx_rowData[fx_h['Date']] = '';
          existing_fx_rowData[fx_h['Day']] = '';
          existing_fx_rowData[fx_h['Time']] = '';
          rowRange.setValues([existing_fx_rowData]);
          Logger.log(`Reverted Fixtures row ${sheetRow} to "Not confirmed".`);
          fixtureUpdated = true;
          break;
        }
    }
      
    // --- 3. SEND CANCELLATION EMAIL ---
      // --- Use the Centralized Test Mode Helper ---
    const originalSubject = `Match CANCELLED: ${opponentClubName} ${opponentTeamName} (Your AWAY Match) vs ${ourClubName} on ${formatDateForSheet(matchDate)}`;
      
      const webAppUrl = settings['Web App URL'];
      const formattedTime = formatTimeFromSheet(proposedTime);
      const emailTemplate = HtmlService.createTemplateFromFile('CancellationEmail.html');
      // Pass standardized variables
      emailTemplate.webAppUrl = webAppUrl;
      emailTemplate.opponentClubName = opponentClubName; 
      emailTemplate.opponentTeamName = opponentTeamName; 
      emailTemplate.matchType = matchType;
      emailTemplate.ourClubName = ourClubName;           
      emailTemplate.ourTeamNumber = ourTeamNumber;  
      emailTemplate.formattedDate = formatDate(matchDate);
      emailTemplate.formattedTime = formattedTime;
      const htmlBody = emailTemplate.evaluate().getContent();
      const plainBody = htmlBody.replace(/<[^>]+>/g, '');

    // Use centralized helper
    const emailInfo = _sendClubEmail(opponentEmail, originalSubject, htmlBody, settings, plainBody);
  
    // --- 4. SYNC AVAILABILITY ---
    const fillResult = fillAvailabilityX();
    const removedX = fillResult ? fillResult.removedX : 0;
    const removedR = fillResult ? fillResult.removedR : 0;

    // --- 5. COMMIT THE FINAL STATUS CHANGE ---
    range.setValue('Cancelled');
    
    // --- 6. SHOW THE FINAL SUCCESS DIALOG ---
    const successTitle = "HOME Match Cancelled!";
    const matchInfo = `${ourClubName} ${ourTeamNumber} vs ${opponentClubName} ${opponentTeamName}`;
    const actions = [
      fixtureUpdated ? `✔ Fixture status reset.` : `⚠ Fixture not found/reset.`,
      `✔ Email sent to ${emailInfo.recipient}.`,
      `✔ Availability synced (Removed ${removedX} 'X' & ${removedR} 'R').`
    ];
    showFinalDialog(successTitle, matchInfo, actions.join('\n'));

  } catch (err) {
    // If any error occurs (e.g., email fails), it's caught here.
    ui.alert(`A critical error occurred: ${err.message}`);
    Logger.log(`CRITICAL ERROR in processCancelledBooking: ${err.message}\nStack: ${err.stack}`);
    if(range) range.setValue(oldValue || "Error");
  }
}

/**
 * [CORE] Processes a "Rejected" status for a HOME booking request.
 * (Called by handleConfirmationEdit)
 * 
 * @param {Object} e The event object.
 * @param {Object} ui The Spreadsheet UI object.
 */
function processRejectedBooking(e, ui) {
  const range = e.range;
  const oldValue = e.oldValue;

  try {
    // --- 1. GET INITIAL DATA (Standardized) ---
    const sheet = range.getSheet();
    const row = range.getRow();
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0].map(h => h.trim());
    const rowData = allData[row - 1];
    const h = {};
    headers.forEach((header, i) => { h[header] = i; });

    // Standardized variable names
    const opponentClubName = rowData[h['Requesting Club']];
    const opponentTeamName = rowData[h['Their Team']];
    const ourTeamNumber = rowData[h['Your Team']];
    const opponentEmail = rowData[h['Contact Email']];
    const proposedDate = rowData[h['Proposed Date']];
    const proposedTime = rowData[h['Proposed Time']];

    // --- 2. SEND REJECTION EMAIL ---
    const settings = getClubSettings();
    const ourClubName = settings['Club Name'] || 'Match Secretary';

    // Call the helper function. It will throw an error if it fails.
    const emailInfo = _sendRejectionEmail(
      true,                  // isHomeRejection
      opponentClubName,
      opponentTeamName,      
      ourTeamNumber,         
      opponentEmail,
      new Date(proposedDate),
      proposedTime
    );

    // --- 3. COMMIT THE FINAL STATUS CHANGE ---
    range.setValue('Rejected');
    
    // --- 4. SHOW THE FINAL SUCCESS DIALOG ---
    const successTitle = "HOME Request Rejected!";
    const matchInfo = `${ourClubName} ${ourTeamNumber} vs ${opponentClubName} ${opponentTeamName}`;
    const actions = `✔ Rejection email sent to ${emailInfo.recipient}.`;
    
    showFinalDialog(successTitle, matchInfo, actions);

  } catch (err) {
    // If any error occurs (e.g., email fails), it's caught here.
    ui.alert(`A critical error occurred: ${err.message}`);
    Logger.log(`CRITICAL ERROR in processRejectedBooking: ${err.message}\nStack: ${err.stack}`);
    if(range) range.setValue(oldValue || "Error");
  }
}

//==============================================================
//--- AWAY BOOKING HANDLERS ---//
//==============================================================

/**
 * [CORE] Processes a "Confirmed" status for an AWAY match proposal.
 * (Called by handleConfirmationEdit)
 * 
 * @param {Object} e The event object.
 * @param {Object} ui The Spreadsheet UI object.
 */
function processConfirmedAwayBooking(e, ui) {
  const range = e.range;
  const oldValue = e.oldValue;

  try {
    // --- 1. GET INITIAL DATA ---
    const sheet = range.getSheet();
    const row = range.getRow();
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0].map(h => h.trim());
    const rowData = allData[row - 1];
    const h = {};
    headers.forEach((header, i) => { h[header] = i; });

    const opponentClubName = rowData[h['Opponent Club']];
    const opponentTeamName = rowData[h['Their Team']];
    const ourTeamNumber = rowData[h['Our Team']];
    const matchType = rowData[h['Match Type']];
    const proposedDate = rowData[h['Proposed Date']];
    const proposedTime = rowData[h['Proposed Time']];
    const opponentEmail = rowData[h['Contact Email']];
    const venueName = rowData[h['Venue']];
    const matchDate = new Date(proposedDate);

    if (isNaN(matchDate.getTime())) {
      throw new Error("Invalid Date. Please fix and reset status.");
    }
    
    // --- 2. VALIDATE & FIND FIXTURE ---
    _validateProposal(ourTeamNumber, matchDate, false); // isHomeMatch = false
    
    const settings = getClubSettings();
    const ourClubName = settings['Club Name'] || 'Match Secretary';
    const fixturesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.FIXTURES);
    if (!fixturesSheet) throw new Error("'Fixtures' sheet not found.");
    
    const fixturesData = fixturesSheet.getDataRange().getValues();
    const fx_h = findFixtureHeaders(fixturesData);
    if (!fx_h) throw new Error("Could not find headers in 'Fixtures' sheet.");

    let foundRowIndex = -1;
    for (let i = fx_h.headerRowIndex + 1; i < fixturesData.length; i++) {
        const fRow = fixturesData[i];
        if (fRow[fx_h['Home / Away']] === 'Away' && fRow[fx_h['Team No.']] === ourTeamNumber && fRow[fx_h['Opposition Club']] === opponentClubName && fRow[fx_h['Opp Team No.']] === opponentTeamName && fRow[fx_h['Match Status']] === 'Not confirmed') {
            foundRowIndex = i;
            break;
        }
    }
    
    if (foundRowIndex === -1) {
      throw new Error('Could not find a corresponding "Not confirmed" AWAY fixture to update.');
    }

    // --- 3. UPDATE FIXTURE & SEND EMAIL ---
    const sheetRow = foundRowIndex + 1;
    const rowRange = fixturesSheet.getRange(sheetRow, 1, 1, fixturesSheet.getLastColumn());
    const fx_rowData = rowRange.getValues()[0];
    
    const division = fx_rowData[fx_h['Div']];
    const event = fx_rowData[fx_h['Event']];
    const sctn = fx_rowData[fx_h['Sctn']];
    const formattedTime = formatTimeFromSheet(proposedTime);
    
    fx_rowData[fx_h['League / Cup']] = matchType;
    fx_rowData[fx_h['Date']] = matchDate;
    fx_rowData[fx_h['Day']] = Utilities.formatDate(matchDate, Session.getScriptTimeZone(), 'EEEE');
    fx_rowData[fx_h['Time']] = formattedTime;
    fx_rowData[fx_h['Venue / Hall']] = venueName;
    fx_rowData[fx_h['Match Status']] = 'Confirmed';
    rowRange.setValues([fx_rowData]);
    Logger.log(`Updated Fixtures row ${sheetRow} for confirmed away match.`);

    // --- Email Logic ---
    const emailTemplate = HtmlService.createTemplateFromFile('AwayConfirmationEmail.html');
    // Pass standardized variables
    emailTemplate.opponentClubName = opponentClubName;
    emailTemplate.ourClubName = ourClubName;
    emailTemplate.event = event || '';
    emailTemplate.division = division || '';
    emailTemplate.sctn = sctn || '';
    emailTemplate.matchType = matchType || '';
    emailTemplate.opponentTeamName = opponentTeamName;
    emailTemplate.ourTeamNumber = ourTeamNumber;
    emailTemplate.formattedDate = formatDate(matchDate);
    emailTemplate.formattedTime = formattedTime;
    emailTemplate.venueName = venueName;
    emailTemplate.formattedShortDate = Utilities.formatDate(matchDate, Session.getScriptTimeZone(), 'd MMM yyyy');
    emailTemplate.formattedDay = Utilities.formatDate(matchDate, Session.getScriptTimeZone(), 'EEEE');

    const htmlBody = emailTemplate.evaluate().getContent();
    const plainBody = htmlBody.replace(/<[^>]+>/g, '');
    
    // --- Use the Centralized Test Mode Helper ---
    const originalSubject = `Match Confirmed: ${opponentClubName} ${opponentTeamName} (Your HOME Match) vs ${ourClubName} ${ourTeamNumber} on ${formatDateForSheet(matchDate)}`;
    
    // Use centralized helper
    const emailInfo = _sendClubEmail(opponentEmail, originalSubject, htmlBody, settings, plainBody);

    // --- 4. SYNC AVAILABILITY ---
    const fillResult = fillAvailabilityX();
    const addedX = fillResult ? fillResult.addedX : 0;
    const addedR = fillResult ? fillResult.addedR : 0;

    // --- 5. COMMIT THE FINAL STATUS CHANGE ---
    range.setValue('Confirmed');
    
    // --- 6. SHOW THE FINAL SUCCESS DIALOG ---
    const alertTitle = "AWAY Match Confirmed!";
    const matchInfo = `${ourClubName} ${ourTeamNumber} vs ${opponentClubName} ${opponentTeamName}`;
    const actions = [
      `✔ Fixture sheet updated.`,
      `✔ Email sent to ${emailInfo.recipient}.`,
      `✔ Availability synced (${addedX} 'X' & ${addedR} 'R' marks).`
    ];
    showFinalDialog(alertTitle, matchInfo, actions.join('\n'));

  } catch (err) {
    ui.alert(`A critical error occurred: ${err.message}`);
    Logger.log(`CRITICAL ERROR in processConfirmedAwayBooking for row ${e.range.getRow()}: ${err.message}\nStack: ${err.stack}`);
    if(range) range.setValue(oldValue || "Error");
  }
}

/**
 * [CORE] Processes a "Cancelled" status for an AWAY match proposal.
 * (Called by handleConfirmationEdit)
 * 
 * @param {Object} e The event object.
 * @param {Object} ui The Spreadsheet UI object.
 */
function processCancelledAwayBooking(e, ui) {
  const range = e.range;
  const oldValue = e.oldValue;

  try {
    // --- 1. GET INITIAL DATA ---
    const sheet = range.getSheet();
    const row = range.getRow();
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0].map(h => h.trim());
    const rowData = allData[row - 1];
    const h = {};
    headers.forEach((header, i) => { h[header] = i; });

    const opponentClubName = rowData[h['Opponent Club']];
    const opponentTeamName = rowData[h['Their Team']];
    const ourTeamNumber = rowData[h['Our Team']];
    const proposedDate = rowData[h['Proposed Date']];
    const proposedTime = rowData[h['Proposed Time']];
    const opponentEmail = rowData[h['Contact Email']];
    const venueName = rowData[h['Venue']];
    const matchDate = new Date(proposedDate);

    if (isNaN(matchDate.getTime())) {
      throw new Error("The date for this proposal is invalid. Please manually check the sheet.");
    }

    // --- 2. FIND & REVERT FIXTURE ---
    const settings = getClubSettings();
    const ourClubName = settings['Club Name'] || 'Match Secretary';
    const fixturesSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.FIXTURES);
    if (!fixturesSheet) throw new Error("'Fixtures' sheet not found.");
    
    const fixturesData = fixturesSheet.getDataRange().getValues();
    const fx_h = findFixtureHeaders(fixturesData);
    if (!fx_h) throw new Error("Could not find headers in 'Fixtures' sheet.");

    let fixtureUpdated = false;
    let foundRowIndex = -1;
    for (let i = fx_h.headerRowIndex + 1; i < fixturesData.length; i++) {
      const fRow = fixturesData[i];
      const fRowDateStr = fRow[fx_h['Date']] ? formatDateForSheet(new Date(fRow[fx_h['Date']])) : null;
      if (fRow[fx_h['Home / Away']] === 'Away' && fRow[fx_h['Team No.']] === ourTeamNumber && fRow[fx_h['Opposition Club']] === opponentClubName && fRow[fx_h['Opp Team No.']] === opponentTeamName && fRow[fx_h['Match Status']] === 'Confirmed' && fRowDateStr === formatDateForSheet(matchDate)) {
        foundRowIndex = i;
        break;
      }
    }

    if (foundRowIndex !== -1) {
      const sheetRow = foundRowIndex + 1;
      const rowRange = fixturesSheet.getRange(sheetRow, 1, 1, fixturesSheet.getLastColumn());
      const fx_rowData = rowRange.getValues()[0];
      fx_rowData[fx_h['Match Status']] = 'Not confirmed';
      fx_rowData[fx_h['Date']] = '';
      fx_rowData[fx_h['Day']] = '';
      fx_rowData[fx_h['Time']] = '';
      fx_rowData[fx_h['Venue / Hall']] = '';
      rowRange.setValues([fx_rowData]);
      Logger.log(`Reverted AWAY Fixture row ${sheetRow} to "Not confirmed".`);
      fixtureUpdated = true;
    } else {
      Logger.log(`Could not find a "Confirmed" AWAY fixture to cancel for ${ourTeamNumber} on ${formatDateForSheet(matchDate)}. A re-sync will still be run.`);
    }

    let emailInfo; // Define here to use in the final dialog
    try {
      const webAppUrl = settings['Web App URL'];
      const formattedTime = formatTimeFromSheet(proposedTime);
      
      const emailTemplate = HtmlService.createTemplateFromFile('AwayCancellationEmail.html');
      emailTemplate.webAppUrl = webAppUrl;
      emailTemplate.opponentClubName = opponentClubName;
      emailTemplate.opponentTeamName = opponentTeamName;
      emailTemplate.ourClubName = ourClubName;
      emailTemplate.ourTeamNumber = ourTeamNumber;
      emailTemplate.formattedDate = formatDate(matchDate);
      emailTemplate.formattedTime = formattedTime;
      emailTemplate.venueName = venueName;
      
      const htmlBody = emailTemplate.evaluate().getContent();
      const plainBody = htmlBody.replace(/<[^>]+>/g, '');

      // --- Use the Centralized Test Mode Helper ---
      const originalSubject = `Match CANCELLED: ${opponentClubName} ${opponentTeamName} (Your HOME Match) vs ${ourClubName} ${ourTeamNumber} on ${formatDateForSheet(matchDate)}`;
      
      // Use centralized helper
      emailInfo = _sendClubEmail(opponentEmail, originalSubject, htmlBody, settings, plainBody);
      Logger.log(`Away cancellation email sent to ${emailInfo.recipient}.`);

    } catch (emailError) {
      // If the email fails, THROW a new, user-friendly error to be caught by the main catch block.
      throw new Error(`Failed to send email. Original error: ${emailError.message}`);
    }

    // --- 4. SYNC AVAILABILITY ---
    const fillResult = fillAvailabilityX();
    const removedX = fillResult ? fillResult.removedX : 0;
    const removedR = fillResult ? fillResult.removedR : 0;

    // --- 5. COMMIT THE FINAL STATUS CHANGE ---
    range.setValue('Cancelled');

    // --- 6. SHOW THE FINAL SUCCESS DIALOG ---
    const alertTitle = "AWAY Match Cancelled!";
    const matchInfo = `${ourClubName} ${ourTeamNumber} vs ${opponentClubName} ${opponentTeamName}`;
    const actions = [
      fixtureUpdated ? `✔ Fixture status reset.` : `⚠ Confirmed fixture was not found to reset.`,
      `✔ Cancellation email sent to ${emailInfo.recipient}.`,
      `✔ Availability synced (Removed ${removedX} 'X' & ${removedR} 'R').`
    ];
    showFinalDialog(alertTitle, matchInfo, actions.join('\n'));

  } catch (err) {
    ui.alert(`A critical error occurred: ${err.message}`);
    Logger.log(`CRITICAL ERROR in processCancelledAwayBooking for row ${e.range.getRow()}: ${err.message}\nStack: ${err.stack}`);
    if (range) range.setValue(oldValue || "Error");
  }
}

/**
 * [CORE] Processes a "Rejected" status for an AWAY match proposal.
 * Its sole job is to send a polite rejection email.
 * (Called by handleConfirmationEdit)
 * 
 * @param {Object} e The event object.
 * @param {Object} ui The Spreadsheet UI object.
 */
function processRejectedAwayBooking(e, ui) {
  const range = e.range;
  const oldValue = e.oldValue;
  
  try {
    // --- 1. GET INITIAL DATA ---
    const sheet = range.getSheet();
    const row = range.getRow();
    const allData = sheet.getDataRange().getValues();
    const headers = allData[0].map(h => h.trim());
    const rowData = allData[row - 1];
    const h = {};
    headers.forEach((header, i) => { h[header] = i; });

    // Standardized variable names
    const opponentClubName = rowData[h['Opponent Club']];
    const opponentTeamName = rowData[h['Their Team']];
    const ourTeamNumber = rowData[h['Our Team']];
    const proposedDate = rowData[h['Proposed Date']];
    const proposedTime = rowData[h['Proposed Time']];
    const opponentEmail = rowData[h['Contact Email']];
    const venueName = rowData[h['Venue']];

    const settings = getClubSettings_(); // Use backend getter
    const ourClubName = settings['Club Name'] || 'Match Secretary';

    // --- 2. SEND REJECTION EMAIL (Using Helper) ---
    // We simply call the helper. It handles templates, branding, and safety.
    
    const emailInfo = _sendRejectionEmail(
      false,                  // isHomeRejection (FALSE for Away)
      opponentClubName,
      opponentTeamName,
      ourTeamNumber,
      opponentEmail,
      new Date(proposedDate),
      proposedTime,
      venueName               // Pass venue for Away matches
    );

    // --- 3. COMMIT THE FINAL STATUS CHANGE ---
    range.setValue('Rejected');

    // --- 4. SHOW THE FINAL SUCCESS DIALOG ---
    const successTitle = "AWAY Proposal Rejected!";
    const matchInfo = `${ourClubName} ${ourTeamNumber} vs ${opponentClubName} ${opponentTeamName}`;
    const actions = `✔ Rejection email sent to ${emailInfo.recipient}.`;
    
    showFinalDialog(successTitle, matchInfo, actions);

  } catch (err) {
    ui.alert(`A critical error occurred: ${err.message}`);
    Logger.log(`CRITICAL ERROR in processRejectedAwayBooking: ${err.message}\nStack: ${err.stack}`);
    if (range) range.setValue(oldValue || "Error");
  }
}

//==============================================================
//--- CORE ADMIN TOOLS ---//
//==============================================================

/**
 * [CORE] Syncs all confirmed fixtures from 'Fixtures' to 'Availability'.
 * This function is now a "manager" that delegates tasks to helper functions.
 * 
 * @returns {Object|null} A summary object of changes, or null if failed.
 */
function fillAvailabilityX() {
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
    
    ui.alert('Sync Fixtures to Availability', finalAlert, ui.ButtonSet.OK);
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
    Logger.log(`Error during fillAvailabilityX: ${e.message}\nStack: ${e.stack}`);
    ui.alert(`Sync failed: ${e.message}`);
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
      if (row[h['Match Status']] === 'Confirmed' && row[h['Date']]) {
        const matchDate = new Date(row[h['Date']]);
        
        if (matchDate >= startOfNextWeek && matchDate <= endOfNextWeek) {
          const dateStr = formatDateForSheet(matchDate);
          const timeStr = row[h['Time']] ? Utilities.formatDate(new Date(row[h['Time']]), Session.getScriptTimeZone(), 'HH:mm') : 'TBC';
          const ourTeam = row[h['Team No.']];
          const homeAway = row[h['Home / Away']];
          const leagueCup = row[h['League / Cup']];
          const oppClub = row[h['Opposition Club']];
          const oppTeam = row[h['Opp Team No.']];
          const venueRaw = row[h['Venue / Hall']];
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
    
    const internalTemplate = HtmlService.createTemplateFromFile('WeeklySummaryEmail.html');
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
    Logger.log(`✅ Internal Summary sent to ${sentInfo.recipient}`);

    // --- 5. Send Opponent Courtesy Reminders ---
    let opponentsContacted = 0;
    for (const oppClub in matchesByOpponent) {
      const contactInfo = opponentContactMap[oppClub];
      if (!contactInfo || !contactInfo.email) continue;

      const matches = matchesByOpponent[oppClub];
      const oppTemplate = HtmlService.createTemplateFromFile('WeeklyOpponentReminder.html');
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
      Logger.log(`📤 Sent reminder for ${oppClub} to ${oppSentInfo.recipient}`);
    }

    if (typeof logAction === 'function') {
       logAction('sendWeeklyMatchSummary', 'Sent Weekly Summaries', { }, `Internal Sent. Opponent Reminders Sent: ${opponentsContacted}`);
    }

  } catch (e) {
    Logger.log(`CRITICAL ERROR in sendWeeklyMatchSummary: ${e.message}\nStack: ${e.stack}`);
    const adminEmail = Session.getActiveUser().getEmail();
    if(adminEmail) {
      MailApp.sendEmail({ to: adminEmail, subject: "ERROR: Weekly Match Summary Failed", body: `Error: ${e.message}` });
    }
  }
}

/**
 * [MENU ITEM] Shows a professional dialog box with a dropdown of opponents,
 * allowing the user to select one to email a summary to.
 */
function showOpponentSummaryDialog() {
  const ui = SpreadsheetApp.getUi();
  try {
    // 1. Get the list of opponent names for the dropdown.
    const oppSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.OPPONENTS);
    if (!oppSheet || oppSheet.getLastRow() < 2) {
      throw new Error(`Could not find any opponents in the '${CONFIG.SHEETS.OPPONENTS}' sheet.`);
    }
    const opponentNames = oppSheet.getRange(2, 1, oppSheet.getLastRow() - 1, 1)
                                  .getValues()
                                  .map(row => row[0])
                                  .filter(name => name)
                                  .sort();

    // 2. Create the HTML template from our new file.
    const template = HtmlService.createTemplateFromFile('OpponentSelectDialog.html');
    
    // 3. Pass the list of names to the template.
    template.opponentNames = opponentNames;

    // 4. Build and show the dialog.
    const htmlOutput = template.evaluate().setWidth(350).setHeight(180);
    ui.showModalDialog(htmlOutput, 'Select Opponent to Email');

  } catch (e) {
    Logger.log(`Error in showOpponentSummaryDialog: ${e.message}`);
    ui.alert(`Error showing dialog: ${e.message}`);
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
      if (row[h['Opposition Club']] === opponentName) {

        // --- Definitive Resilient Date Handling Logic ---
        const rawDateString = row[h['Date']];
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
        const matchTime = row[h['Time']] ? Utilities.formatDate(new Date(row[h['Time']]), Session.getScriptTimeZone(), 'HH:mm') : 'TBC';

        relevantMatches.push({
          date: displayDate,
          day: displayDay,
          sortableDate: sortableDate,
          time: matchTime,
          ourTeamNumber: row[h['Team No.']] || '',
          theirTeamNumber: row[h['Opp Team No.']] || '',
          homeAway: row[h['Home / Away']] || '',
          venue: row[h['Venue / Hall']] || '',
          status: row[h['Match Status']] || '',
          event: row[h['Event']] || '',
          div: row[h['Div']] || '',
          sctn: row[h['Sctn']] || '',
          leagueCup: row[h['League / Cup']] || ''
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
    const emailTemplate = HtmlService.createTemplateFromFile('OpponentSummaryEmail.html');
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
    Logger.log(`Error in sendOpponentSummaryEmail: ${e.message}`);
    ui.alert(`Error: ${e.message}`);
  }
}

//==============================================================
//--- ADMIN MENU ITEMS & SIDEBARS ---//
//==============================================================

function fillAvailabilityX_menu() {
  fillAvailabilityX();
}

/** [MENU ITEM] Shows the sidebar UI for finding away match dates. */
function showAwayFinderSidebar() {
  const html = HtmlService.createHtmlOutputFromFile('AwayFinder.html').setTitle('Away Match Finder');
  SpreadsheetApp.getUi().showSidebar(html);
}

/** [MENU ITEM] Shows the sidebar UI for clearing a player's unavailability. */
function clearPlayerUnavailability_menu() {
  const html = HtmlService.createHtmlOutputFromFile('PlayerClearer').setTitle("Clear Player 'U's");
  SpreadsheetApp.getUi().showSidebar(html);
}

//==============================================================
//--- ADMIN HELPER FUNCTIONS ---//
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

    if (club !== clubName || !team || status !== 'Confirmed' || !dateVal || isNaN(new Date(dateVal).getTime())) {
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