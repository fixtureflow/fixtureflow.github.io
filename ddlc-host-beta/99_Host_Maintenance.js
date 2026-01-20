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
  BadmintonLib.showResetAllDialog();
}

/**
 * [ADMIN] Core logic to clear ALL 'U' marks from the entire grid.
 * Safely removes 'U's without touching the ADMIN_LOCK column.
 */
function _resetAllPlayerAvailability(confirmation) {
  BadmintonLib._resetAllPlayerAvailability(confirmation);
}
