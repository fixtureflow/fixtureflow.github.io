/*******************************************************************
 * Match Admin System: Spreadsheet Administration & Triggers
 *
 * This file contains all functions that are executed from the
 * Google Sheet interface, either via the custom "Match Admin" menu
 * or by automated triggers like `onEdit`.
 * 
 * CORE LOGIC has been moved to `3_Spreadsheet_Admin_Logic.js`.
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
  const actionableStatuses = [
    CONFIG.STATUSES.CONFIRMED.toLowerCase(),
    CONFIG.STATUSES.CANCELLED.toLowerCase(),
    CONFIG.STATUSES.REJECTED.toLowerCase()
  ];

  // 1. First, check if the new status is one we actually care about.
  if (actionableStatuses.includes(newValue)) {
    
    // 2. If it is, NOW we lock the UI.
    const ui = SpreadsheetApp.getUi();
    const htmlOutput = HtmlService.createHtmlOutputFromFile(CONFIG.TEMPLATES.LOADING_SPINNER)
      .setWidth(250)
      .setHeight(150);
    ui.showModalDialog(htmlOutput, 'Processing...');
    SpreadsheetApp.flush();

    // 3. And finally, route to the unified processor.
    const sheetName = sheet.getName();
    const isHome = (sheetName === CONFIG.SHEETS.BOOKING_REQUESTS);
    // const settings = getClubSettings_(); // REMOVED: API wrapper handles this

    if (isHome || sheetName === CONFIG.SHEETS.AWAY_MATCH_PROPOSALS) {
      _processBookingChange(e, newValue, isHome); // Call wrapper (which calls _Internal)
    }
  }
  // If the newValue is 'pending' or anything else, the function simply ends here.
}

//==============================================================
//--- ADMIN MENU ITEMS & SIDEBARS ---//
//==============================================================

function fillAvailabilityX_menu() {
  fillAvailabilityX(); // Call wrapper
}

/** [MENU ITEM] Shows the sidebar UI for finding away match dates. */
function showAwayFinderSidebar() {
  const html = HtmlService.createHtmlOutputFromFile(CONFIG.TEMPLATES.AWAY_FINDER).setTitle('Away Match Finder');
  SpreadsheetApp.getUi().showSidebar(html);
}

/** [MENU ITEM] Shows the sidebar UI for clearing a player's unavailability. */
function clearPlayerUnavailability_menu() {
  const html = HtmlService.createHtmlOutputFromFile(CONFIG.TEMPLATES.PLAYER_CLEARER).setTitle("Clear Player 'U's");
  SpreadsheetApp.getUi().showSidebar(html);
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
    const template = HtmlService.createTemplateFromFile(CONFIG.TEMPLATES.OPPONENT_SELECT_DIALOG);
    
    // 3. Pass the list of names to the template.
    template.opponentNames = opponentNames;

    // 4. Build and show the dialog.
    const htmlOutput = template.evaluate().setWidth(350).setHeight(180);
    ui.showModalDialog(htmlOutput, 'Select Opponent to Email');

  } catch (e) {
    console.log(`Error in showOpponentSummaryDialog: ${e.message}`);
    ui.alert(`Error showing dialog: ${e.message}`);
  }
}