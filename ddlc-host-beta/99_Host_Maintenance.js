/*******************************************************************
 * Match Admin System: Host Maintenance & Setup Utilities
 *
 * Contains functions that MUST run in the Host Script context
 * because they interact with Triggers, Properties, or Sheets directly
 * in ways that are specific to this deployment instance.
 *******************************************************************/
//==============================================================
// 9️⃣9️⃣ HOST MAINTENANCE
//==============================================================

/**
 * [ADMIN] Installs the onEdit trigger needed for the 'Booking Requests' sheet.
 * This is safe to run multiple times.
 */
function setupTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let triggerExists = false;
  const handlerFunction = 'handleConfirmationEdit'; // The function to trigger

  const allTriggers = ScriptApp.getUserTriggers(ss);
  for (const trigger of allTriggers) {
    if (trigger.getHandlerFunction() === handlerFunction) {
      triggerExists = true;
      break;
    }
  }

  if (triggerExists) {
    SpreadsheetApp.getUi().alert('Trigger is already installed. No action needed.');
  } else {
    ScriptApp.newTrigger(handlerFunction)
      .forSpreadsheet(ss)
      .onEdit()
      .create();

    SpreadsheetApp.getUi().alert('Success! The booking confirmation trigger has been installed.');
  }
}

/**
 * [ADMIN] Installs the time-driven trigger for the weekly match summary email.
 * Scheduled for Friday at 4 PM.
 */
function setupWeeklySummaryTrigger() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  const handlerFunction = 'sendWeeklyMatchSummary';
  let triggerExists = false;

  const allTriggers = ScriptApp.getUserTriggers(ss);
  for (const trigger of allTriggers) {
    if (trigger.getHandlerFunction() === handlerFunction) {
      triggerExists = true;
      break;
    }
  }

  if (triggerExists) {
    ui.alert('The Weekly Summary trigger is already installed. No action needed.');
    return;
  }
  
  try {
    ScriptApp.newTrigger(handlerFunction)
      .timeBased()
      .onWeekDay(ScriptApp.WeekDay.FRIDAY)
      .atHour(16)
      .create();

    ui.alert('Success! The automated Weekly Match Summary trigger has been installed.');
    Logger.log("Weekly Summary Trigger created successfully for Friday afternoons.");

  } catch (e) {
    Logger.log(`Failed to create Weekly Summary Trigger: ${e.message}`);
    ui.alert(`An error occurred while creating the trigger: ${e.message}`);
  }
}

/**
 * [MENU ITEM] Finds and updates the 'Web App URL' in the 'Settings' sheet
 * by reading the last known URL that the web app saved about itself.
 */
function updateWebAppUrl() {
  const ui = SpreadsheetApp.getUi();
  try {
    const latestUrl = PropertiesService.getScriptProperties().getProperty('LAST_KNOWN_URL');
    
    if (!latestUrl) {
      throw new Error("Could not retrieve the web app URL from memory. Please visit the web app URL once and try this again.");
    }

    const settingsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.SHEETS.SETTINGS);
    if (!settingsSheet) {
      throw new Error(`The '${CONFIG.SHEETS.SETTINGS}' sheet could not be found.`);
    }

    const settingName = 'Web App URL';
    const data = settingsSheet.getDataRange().getValues();
    let settingRow = -1;

    for (let i = 0; i < data.length; i++) {
      if (data[i][0] === settingName) {
        settingRow = i + 1;
        break;
      }
    }

    if (settingRow !== -1) {
      settingsSheet.getRange(settingRow, 2).setValue(latestUrl);
    } else {
      settingsSheet.appendRow([settingName, latestUrl]);
    }

    ui.alert('Success!', `The 'Web App URL' setting has been successfully updated to:\n\n${latestUrl}`, ui.ButtonSet.OK);

  } catch (e) {
    Logger.log(`Error in updateWebAppUrl: ${e.message}`);
    ui.alert('Error', `Could not update the Web App URL:\n\n${e.message}`, ui.ButtonSet.OK);
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
    _resetAllPlayerAvailability(confirmationText);
  } else {
    ui.alert('Action cancelled. No changes were made.');
  }
}

/**
 * [ADMIN] Core logic to clear ALL 'U' marks from the entire grid.
 * Safely removes 'U's without touching the ADMIN_LOCK column.
 */
function _resetAllPlayerAvailability(confirmation) {
  const ui = SpreadsheetApp.getUi();
  const CONFIRMATION_PHRASE = 'CONFIRM NUKE';

  if (confirmation !== CONFIRMATION_PHRASE) {
    ui.alert(`Incorrect confirmation phrase entered.\n\nAction cancelled.`);
    return;
  }

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
    const newData = availData.map(row => [...row]);

    // Loop through cells, skipping headers and date column (col 0)
    for (let r = 1; r < newData.length; r++) {
      for (let c = 1; c < newData[r].length; c++) {
        if (c === adminLockCol) continue;

        const cellValue = String(newData[r][c]).trim().toUpperCase();
        if (cellValue === 'U') {
          newData[r][c] = '';
          removedCount++;
        }
      }
    }

    if (removedCount > 0) {
      availDataRange.setValues(newData);
      ui.alert(`Reset Complete.\n\nRemoved ${removedCount} 'U' marks from the Availability grid.`);
    } else {
      ui.alert('No \'U\' marks were found to remove.');
    }

  } catch (e) {
    Logger.log(`Error in _resetAllPlayerAvailability: ${e.message}`);
    ui.alert(`An error occurred: ${e.message}`);
  }
}
