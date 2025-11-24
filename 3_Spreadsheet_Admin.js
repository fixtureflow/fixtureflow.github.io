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

  // Ignore edits to the header row
  if (e.range.getRow() <= 1) return;

  // --- NEW: Auto-Clear Cache on Settings Change ---
  if (sheet.getName() === CONFIG.SHEETS.SETTINGS) {
    // Only trigger if editing the "Setting Value" column (Column 2)
    // We check the header row (Row 1) to be safe, or just check column index.
    // Checking header name is safer against column moves.
    const header = sheet.getRange(1, e.range.getColumn()).getValue();
    if (header !== CONFIG.HEADERS.SETTING_VALUE) return;

    // Read the settings directly from the sheet (fresh data)
    const settings = getClubSettings_();

    // Check if Auto-Clear is enabled (Default to TRUE if missing, for convenience)
    // User can set "Auto-Clear Cache" to "FALSE" in the sheet to disable this during onboarding.
    const autoClear = String(settings[CONFIG.SETTINGS_KEYS.AUTO_CLEAR_CACHE] || 'TRUE').trim().toUpperCase() === 'TRUE';

    if (autoClear) {
      const keysToClear = [
        'CLUB_SETTINGS', 'OUR_TEAMS', 'SEASON_MONTHS',
        'OPPONENT_CLUBS', 'PENDING_FIXTURES', 'PENDING_AWAY_FIXTURES'
      ];
      CacheService.getScriptCache().removeAll(keysToClear);
      SpreadsheetApp.getActiveSpreadsheet().toast("Cache cleared! Web App will now reflect new settings.", "Settings Updated");
    }
    return;
  }

  // For other sheets, check if it's a Status column edit
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
    const htmlOutput = getLoadingSpinnerHtml();
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
  const html = getAwayFinderHtml();
  SpreadsheetApp.getUi().showSidebar(html);
}

/** [MENU ITEM] Shows the sidebar UI for clearing a player's unavailability. */
function clearPlayerUnavailability_menu() {
  const html = getPlayerClearerHtml();
  SpreadsheetApp.getUi().showSidebar(html);
}

/**
 * [MENU ITEM] Shows a professional dialog box with a dropdown of opponents,
 * allowing the user to select one to email a summary to.
 */
function showOpponentSummaryDialog() {
  const ui = SpreadsheetApp.getUi();
  try {
    // Use wrapper to get the dialog HTML (data fetching is now internal to the wrapper)
    const htmlOutput = getOpponentSelectDialogHtml();
    ui.showModalDialog(htmlOutput, 'Select Opponent to Email');

  } catch (e) {
    console.log(`Error in showOpponentSummaryDialog: ${e.message}`);
    ui.alert(`Error showing dialog: ${e.message}`);
  }
}