/*******************************************************************
 * Match Admin System: Developer & Deployment Utilities
 *
 * A collection of high-privilege, "developer-only" functions used
 * for initial system setup, deployment, and destructive maintenance
 * tasks. These functions are typically hidden from the end-user's menu.
 *******************************************************************/
//==============================================================
// 9️⃣9️⃣ ADMIN & DEPLOYMENT UTILITIES
//==============================================================



/**
 * [ADMIN] Core logic to clear ALL 'U' marks from the entire grid.
 * This function is intentionally designed to ONLY run if it receives the exact confirmation phrase from the dialog function.
 * 
 * @param {string} confirmation The text the user typed into the confirmation dialog.
 */
function _resetAllPlayerAvailability(confirmation) {
  const ui = SpreadsheetApp.getUi();
  const CONFIRMATION_PHRASE = 'CONFIRM NUKE';

  // --- THE SAFEGUARD CHECK ---
  if (confirmation !== CONFIRMATION_PHRASE) {
    ui.alert(`Incorrect confirmation phrase entered.\n\nAction cancelled. No changes were made.`);
    return; // Stop immediately
  }

  // --- If we get here, the user is sure. Proceed with the logic. ---
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const availabilitySheet = ss.getSheetByName(CONFIG.SHEETS.AVAILABILITY);

    if (!availabilitySheet) {
      throw new Error(`'${CONFIG.SHEETS.AVAILABILITY}' sheet not found.`);
    }

    const availDataRange = availabilitySheet.getDataRange();
    const availData = availDataRange.getValues();
    const headers = availData[0];
    const adminLockCol = headers.indexOf(CONFIG.HEADERS.ADMIN_LOCK);

    let removedCount = 0;
    // Create a copy of the data to modify
    const newData = availData.map(row => [...row]);

    // Loop through every cell, skipping the first row (headers) and first column (date)
    for (let r = 1; r < newData.length; r++) {
      for (let c = 1; c < newData[r].length; c++) {
        // IMPORTANT: Do not clear the ADMIN_LOCK column
        if (c === adminLockCol) {
          continue;
        }

        const cellValue = String(newData[r][c]).trim().toUpperCase();
        if (cellValue === 'U') {
          newData[r][c] = ''; // Clear the cell
          removedCount++;
        }
      }
    }

    if (removedCount > 0) {
      availDataRange.setValues(newData);
      logAction('_resetAllPlayerAvailability', 'Reset all player availability', { removedU: removedCount });
      ui.alert(`Reset Complete.\n\nRemoved ${removedCount} 'U' marks from the Availability grid.`);
    } else {
      ui.alert('No \'U\' marks were found to remove. No changes were made.');
    }

  } catch (e) {
    Logger.log(`Error in _resetAllPlayerAvailability: ${e.message}\nStack: ${e.stack}`);
    ui.alert(`An error occurred: ${e.message}`);
  }
}

/**
 * [MENU ITEM] Shows a confirmation dialog before resetting all availability.
 */
function showResetAllDialog() {
  const ui = SpreadsheetApp.getUi();
  const title = 'WARNING: EXTREMELY DESTRUCTIVE ACTION';
  const prompt = 'You are about to remove ALL \'U\' (Unavailable) marks for ALL players.\n\n' +
    'This action cannot be undone and is intended for end-of-season cleanup.\n\n' +
    'To proceed, you must type the exact phrase "CONFIRM NUKE" into the box below and click OK.';
  
  const response = ui.prompt(title, prompt, ui.ButtonSet.OK_CANCEL);

  if (response.getSelectedButton() == ui.Button.OK) {
    const confirmationText = response.getResponseText();
    // Pass the user's confirmation text to the core logic function
    _resetAllPlayerAvailability(confirmationText);
  } else {
    ui.alert('Action cancelled. No changes were made.');
  }
}

/**
 * [ADMIN] Installs the onEdit trigger needed for the 'Booking Requests' sheet.
 * This is safe to run multiple times.
 */
function setupTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let triggerExists = false;
  const handlerFunction = 'handleConfirmationEdit'; // The function to trigger

  // 1. Check if the trigger is already installed
  const allTriggers = ScriptApp.getUserTriggers(ss);
  for (const trigger of allTriggers) {
    if (trigger.getHandlerFunction() === handlerFunction) {
      triggerExists = true;
      break;
    }
  }

  // 2. Install if it doesn't exist, or inform the user if it does
  if (triggerExists) {
    SpreadsheetApp.getUi().alert('Trigger is already installed. No action needed.');
  } else {
    // Create the new trigger
    ScriptApp.newTrigger(handlerFunction)
      .forSpreadsheet(ss)
      .onEdit()
      .create();

    SpreadsheetApp.getUi().alert('Success! The booking confirmation trigger has been installed. This sheet is now ready.');
  }
}

/**
 * [ADMIN] Installs the time-driven trigger for the weekly match summary email.
 * This is safe to run multiple times. If the trigger already exists,
 * it will not create a duplicate.
 * Scheduled the trigger for Friday afternoon.
 */
function setupWeeklySummaryTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const handlerFunction = 'sendWeeklyMatchSummary';
  let triggerExists = false;

  // 1. Check all existing project triggers to see if ours is already there.
  const allTriggers = ScriptApp.getUserTriggers(ss);
  for (const trigger of allTriggers) {
    if (trigger.getHandlerFunction() === handlerFunction) {
      triggerExists = true;
      break;
    }
  }

  // 2. If the trigger already exists, inform the user and stop.
  if (triggerExists) {
    ui.alert('The Weekly Summary trigger is already installed. No action needed.');
    return;
  }
  
  // 3. If it does not exist, create it with the new, improved settings.
  try {
    ScriptApp.newTrigger(handlerFunction)
      .timeBased() // Start with the time-based builder directly
      .onWeekDay(ScriptApp.WeekDay.FRIDAY)
      .atHour(16)
      .create();

    SpreadsheetApp.getUi().alert('Success! The automated Weekly Match Summary trigger has been installed.\n\nYou will receive an email every Friday afternoon with a summary of the FOLLOWING week\'s matches (Mon-Sun).');
    Logger.log("Weekly Summary Trigger created successfully for Friday afternoons.");

  } catch (e) {
    Logger.log(`Failed to create Weekly Summary Trigger: ${e.message}`);
    ui.alert(`An error occurred while creating the trigger: ${e.message}`);
  }
}

/**
 * [ADMIN] Cache Clearing Utility.
 * This version intelligently checks the "Enable Away Booking" setting
 * and only attempts to clear the away fixtures cache if the feature is active.
 * It also provides a clear reminder to the user about the manual cache-clearing step.
 */
function clearCache_() {
  // 1. Start with the list of cache keys that are ALWAYS used.
  const keysToClear = [
    'CLUB_SETTINGS',
    'OUR_TEAMS',
    'SEASON_MONTHS',
    'OPPONENT_CLUBS',
    'PENDING_FIXTURES'
  ];

  // 2. Intelligently add the away fixtures key ONLY if the feature is enabled.
  const settings = getClubSettings(); // This is fast; it will use the cache if available.
  if (settings['Enable Away Booking'] === 'TRUE') {
    keysToClear.push('PENDING_AWAY_FIXTURES');
  }

  // 3. Now, attempt to remove all keys that are currently active.
  CacheService.getScriptCache().removeAll(keysToClear);
  Logger.log(`Attempted to clear the following backend caches: ${keysToClear.join(', ')}`);

  // 4. Provide a helpful alert to the user.
  const ui = SpreadsheetApp.getUi();
  ui.alert(
    'Cache Cleared (Reminder)',
    'The script has cleared the server-side cache. To ensure the web app loads the absolute latest version, you should also:\n\n1. Do a hard refresh (Ctrl+Shift+R or Cmd+Shift+R) on the web app tab.\n2. (If issues persist) Manually add "?action=clear" to the end of the deployment URL.',
    ui.ButtonSet.OK
  );
}

/**
 * [ADMIN] Prompts the developer to enter a setting name (key)
 * and displays the current value stored in the secure PropertiesService.
 * This is a debugging tool and should be hidden from the end-user menu.
 */
function _admin_checkSingleProperty() {
  const ui = SpreadsheetApp.getUi();
  
  // 1. Ask the developer which setting they want to check.
  const keyResponse = ui.prompt(
    'Check Property Value',
    'Enter the exact name of the setting you want to check:',
    ui.ButtonSet.OK_CANCEL
  );

  // 2. Check if the developer clicked "Cancel" or entered nothing.
  if (keyResponse.getSelectedButton() !== ui.Button.OK || !keyResponse.getResponseText()) {
    ui.alert('Action cancelled.');
    return;
  }
  
  const key = keyResponse.getResponseText().trim();

  try {
    // 3. Go to the secure storage area...
    const scriptProperties = PropertiesService.getScriptProperties();
    // ...and ask for the value associated with the key the developer entered.
    const value = scriptProperties.getProperty(key);

    // 4. Report the result back to the developer.
    if (value === null) {
      // This means the key doesn't exist in storage.
      ui.alert('Check Result', `The property "${key}" does not exist in secure storage.`, ui.ButtonSet.OK);
    } else {
      // We found it! Display the value.
      ui.alert('Check Result', `The current secure value for "${key}" is:\n\n${value}`, ui.ButtonSet.OK);
    }
  } catch (e) {
    ui.alert('Error', `Could not read the property: ${e.message}`, ui.ButtonSet.OK);
  }
}

/**
 * [ADMIN] Applies all necessary sheet and range protections for a production
 * environment. It protects core data sheets while leaving specific columns/cells editable.
 * This is called by the main saveSettingsToProperties() function.
 */
function _applyProductionProtections() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // --- Category 1: The Tool Shed (Warning on Edit) ---
  // All data sheets are placed here. This allows the script to write to them
  // freely (e.g., logs) and allows a knowledgeable user to make deliberate
  // corrections after dismissing a warning.
  const sheetsWithWarning = [
    CONFIG.SHEETS.TEAMS,
    CONFIG.SHEETS.OPPONENTS,
    CONFIG.SHEETS.PROCESSING_LOG,
    CONFIG.SHEETS.EVENT_LOG,
    'Form_responses_1' // Moved to this category to allow for manual data correction
  ];

  for (const sheetName of sheetsWithWarning) {
    const sheet = ss.getSheetByName(sheetName);
    if (sheet) {
      const protection = sheet.protect().setDescription(`${sheetName} - Warning on Edit`);
      protection.setWarningOnly(true);
      Logger.log(`'${sheetName}' sheet is now protected with a warning.`);
    }
  }

  // --- Category 2: Special Cases with Exceptions ---
  // Case A: Protect the 'Fixtures' sheet but leave specific columns open.
  const fixturesSheet = ss.getSheetByName(CONFIG.SHEETS.FIXTURES);
  if (fixturesSheet) {
    try {
      // --- Step 1: Dynamically find the header row ---
      // We will search for the "No" column to locate the real header row.
      const headerFinder = fixturesSheet.createTextFinder("No").matchEntireCell(true).findNext();
      if (!headerFinder) {
        throw new Error("Could not find the 'No' header in the Fixtures sheet. Cannot apply protection.");
      }
      const headerRow = headerFinder.getRow();

      // --- Step 2: Apply the main protection to the entire sheet ---
      const protection = fixturesSheet.protect().setDescription('Fixtures Data - Warning on Edit');
      protection.setWarningOnly(true);

      // --- Step 3: Define and find the columns to un-protect ---
      const headersToFind = ['Venue / Hall', 'Match Status', 'Court Booked?'];
      const headers = fixturesSheet.getRange(headerRow, 1, 1, fixturesSheet.getLastColumn()).getValues()[0];
      const unprotectedRanges = [];

      for (const headerName of headersToFind) {
        const colIndex = headers.indexOf(headerName);
        if (colIndex !== -1) {
          const column = colIndex + 1;
          // Un-protect from the row *after* the header down to the last row with data.
          const rangeToUnprotect = fixturesSheet.getRange(headerRow + 1, column, fixturesSheet.getLastRow());
          unprotectedRanges.push(rangeToUnprotect);
          Logger.log(`Found column "${headerName}" to un-protect.`);
        } else {
          Logger.log(`Could not find column "${headerName}" to un-protect. It will remain protected.`);
        }
      }

      // --- Step 4: Apply the exceptions ---
      if (unprotectedRanges.length > 0) {
        protection.setUnprotectedRanges(unprotectedRanges);
        Logger.log(`'Fixtures' sheet protected with ${unprotectedRanges.length} column exceptions.`);
      }

    } catch (e) {
      Logger.log(`Failed to apply protection to Fixtures sheet: ${e.message}`);
      // We log the error but don't stop the whole script, allowing other protections to proceed.
    }
  }
  
  // Case B: Protect specific columns in 'Availability'
  const availabilitySheet = ss.getSheetByName(CONFIG.SHEETS.AVAILABILITY);
  if (availabilitySheet) {
    const rangeToProtect = availabilitySheet.getRange("A:B"); // Date and ADMIN_LOCK
    const protection = rangeToProtect.protect().setDescription('Availability Date Column - Warning on Edit');
    protection.setWarningOnly(true);
    Logger.log("'Availability' date columns protected.");
  }
  
  // Case C: Protect 'Team_View' except for the team selection dropdown
  const teamViewSheet = ss.getSheetByName(CONFIG.SHEETS.TEAM_VIEW);
  if(teamViewSheet) {
    const protection = teamViewSheet.protect().setDescription('Team View Dashboard - Warning on Edit');
    protection.setWarningOnly(true);
    // Un-protect only cell B1 where the user selects a team
    const unprotectedRange = teamViewSheet.getRange('B1');
    protection.setUnprotectedRanges([unprotectedRange]);
    Logger.log("'Team_View' sheet protected with an exception for the dropdown.");
  }
}

/**
 * [ADMIN] Reads settings from the 'Settings' sheet, saves them securely,
 * programmatically disables Test Mode, protects the sheet, and then hides it.
 * This is the complete, one-click "lock-down" and deployment function.
 */
function saveSettingsToProperties_() {
  const ui = SpreadsheetApp.getUi();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const settingsSheet = ss.getSheetByName(CONFIG.SHEETS.SETTINGS);
    if (!settingsSheet) {
      throw new Error(`The '${CONFIG.SHEETS.SETTINGS}' sheet was not found.`);
    }
    
    const data = settingsSheet.getRange('A2:B' + settingsSheet.getLastRow()).getValues();
    const scriptProperties = PropertiesService.getScriptProperties();
    let settingsCount = 0;
    
    // --- Step 1: Save all visible settings to secure storage ---
    for (const row of data) {
      const key = row[0];
      const value = row[1];
      if (key) {
        scriptProperties.setProperty(key, value);
        settingsCount++;
      }
    }

    if (settingsCount === 0) {
      throw new Error("No settings were found on the 'Settings' sheet to save.");
    }
    
    // --- Step 2: AUTOMATICALLY DISABLE TEST MODE ---
    // This is the new, crucial "pre-flight check".
    scriptProperties.setProperty('Test Mode Active', 'FALSE');
    scriptProperties.setProperty('Test Mode Email', ''); // Clear the test email address
    Logger.log("Deployment lock-down: Test Mode has been programmatically disabled.");
      
    // --- Step 3: Automated Protection Logic ---
    const protection = settingsSheet.protect().setDescription('Master admin settings - script protected');
    const me = Session.getEffectiveUser();
    protection.addEditor(me);
    protection.removeEditors(protection.getEditors());
    if (protection.canDomainEdit()) {
      protection.setDomainEdit(false);
    }
    
    // --- Step 4: Hide the now-secure sheet ---
    settingsSheet.hideSheet();

    // --- Step 5: Apply All Other Production Sheet Protections ---
    _applyProductionProtections();
    
    // --- Step 6: Final Confirmation ---
    ui.alert(
      'Lock-Down Successful!', 
      `Successfully saved ${settingsCount} settings, programmatically DISABLED Test Mode, and applied all production sheet protections.\n\nThe system is now ready for the client.`, 
      ui.ButtonSet.OK
    );

  } catch (e) {
    Logger.log(`Error in saveSettingsToProperties: ${e.message}`);
    ui.alert('Error', `The lock-down process failed:\n\n${e.message}`, ui.ButtonSet.OK);
  }
}