/*******************************************************************
 * Match Admin System: Configuration & Setup
 * 
 * Contains the foundational configuration for the entire
 * application, including the global CONFIG object and the
 * functions for creating the admin menu and installing triggers.
 *******************************************************************/
//==============================================================
// 0️⃣ CONFIG & SETUP
//==============================================================

/**
 * [CORE] The Global Configuration Object.
 * Holds all "magic strings" like sheet names, header names, and column indices.
 * If you ever rename a sheet or header in the spreadsheet, you MUST update it here.
 */
const CONFIG = {
  SHEETS: {
    SETTINGS: 'Settings',
    FIXTURES: 'Fixtures',
    TEAMS: 'Teams',
    AVAILABILITY: 'Availability',
    BOOKING_REQUESTS: 'Booking Requests',
    AWAY_MATCH_PROPOSALS: 'Away Match Proposals',
    OPPONENTS: 'Opponent Info',
    FORM_RESPONSES: 'Form Responses 1',
    SYSTEM_LOG: 'Event_Log',
    PROCESSING_LOG: 'Processing_Log'
  },
  HEADERS: {
    ADMIN_LOCK: 'ADMIN_LOCK',
    STATUS: 'Status',
    PLAYER_NAME: 'Player Name',
    UNAVAILABLE_DATES: 'Unavailable Dates',
    // Expanded Headers for Validation & Emailing
    REQ_CLUB: 'Requesting Club',
    REQ_THEIR_TEAM: 'Their Team',
    REQ_YOUR_TEAM: 'Your Team',
    REQ_DATE: 'Proposed Date',
    OPP_CLUB: 'Opponent Club',
    OPP_TEAM: 'Their Team', // Note: In Away Proposals, it's "Their Team" vs "Our Team"
    OPP_OUR_TEAM: 'Our Team',
    FIXTURE_DATE: 'Date',
    FIXTURE_TIME: 'Time',
    FIXTURE_HOME_AWAY: 'Home / Away',
    FIXTURE_STATUS: 'Match Status',
    FIXTURE_OPP_CLUB: 'Opposition Club',
    FIXTURE_OPP_TEAM: 'Opp Team No.',
    FIXTURE_OUR_TEAM: 'Team No.',
    FIXTURE_VENUE: 'Venue / Hall',
    FIXTURE_LEAGUE_CUP: 'League / Cup',
    FIXTURE_EVENT: 'Event',
    FIXTURE_DIV: 'Div',
    FIXTURE_SCTN: 'Sctn'
  },
  STATUSES: {
    PENDING: 'Pending',
    NOT_CONFIRMED: 'Not confirmed',
    CONFIRMED: 'Confirmed',
    REJECTED: 'Rejected',
    CANCELLED: 'Cancelled'
  },
  TEMPLATES: {
    WEEKLY_SUMMARY: 'WeeklySummaryEmail',
    OPPONENT_REMINDER: 'WeeklyOpponentReminder',
    OPPONENT_SUMMARY: 'OpponentSummaryEmail',
    CONFIRMATION: 'ConfirmationEmail',
    REJECTION: 'RejectionEmail',
    CANCELLATION: 'CancellationEmail',
    AWAY_CONFIRMATION: 'AwayConfirmationEmail',
    AWAY_REJECTION: 'AwayRejectionEmail',
    AWAY_CANCELLATION: 'AwayCancellationEmail',
    OPPONENT_SELECT_DIALOG: 'OpponentSelectDialog',
    AWAY_FINDER: 'AwayFinder',
    PLAYER_CLEARER: 'PlayerClearer',
    LOADING_SPINNER: 'LoadingSpinner'
  },
  TEAM_SHEET: {
    ALLOWED_DAYS_COL: 2, // Column C (NEW)
    PLAYER_START_COL: 3, // Column D (WAS 2)
    PLAYER_END_COL: 8    // Column H (WAS 7) (this is for slice(2, 7))
  },
  SETTINGS_KEYS: {
    CLUB_NAME: 'Club Name',
    MATCH_SECRETARY_EMAIL: 'Match Secretary Email',
    ENABLE_AWAY_BOOKING: 'Enable Away Booking',
    CLUB_LOGO_LINK: 'Club Logo Link',
    AUTO_CLEAR_CACHE: 'Auto-Clear Cache',
    TEAM_BUFFER_DAYS: 'Team Buffer Days (each side)'
  }
};

/**
 * [CORE] The Developer Email Address.
 * Used to grant access to Tier 2 Admin Tools in the menu.
 * IMPORTANT: Set this to the email address of the developer/admin.
 */
const DEVELOPER_EMAIL = 'fixtureflow.ddlc@gmail.com'; 

/**
 * [TRIGGER] The onOpen Trigger.
 * Creates the main "Match Admin" menu when the spreadsheet is opened.
 * 
 * V3: Implements a three-tiered access system.
 * - Tier 1: General user functions.
 * - Tier 2: Hidden admin tools for the developer.
 * - Tier 3: Nuclear/setup functions with NO menu item (run from editor only).
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Match Admin');

  // --- Tier 1: General User Functions ---
  menu.addItem('Sync Fixtures to Availability (X & R)', 'fillAvailabilityX_menu');
  menu.addItem('Process New Unavailability Submissions (U)', 'processSubmissions');
  menu.addSeparator();
  menu.addItem('Find Away Match Dates', 'showAwayFinderSidebar');
  menu.addSeparator();
  menu.addItem('Send Opponent Summary...', 'showOpponentSummaryDialog');    
  
  // --- Tier 2: Hidden Admin Tools (Visible only to Developer) ---
  if (Session.getEffectiveUser().getEmail() === DEVELOPER_EMAIL) {
    menu.addSeparator();
    const adminMenu = ui.createMenu('Admin Tools');
    adminMenu.addItem('Clear Player\'s Unavailability (U)', 'clearPlayerUnavailability_menu');
    adminMenu.addItem("!! Reset ALL Player Availability !!", 'showResetAllDialog')
    adminMenu.addSeparator();
    adminMenu.addItem('Clear Web App Cache', 'clearCache');
    adminMenu.addItem('Update Web App URL in Settings', 'updateWebAppUrl');
    adminMenu.addSeparator();
    adminMenu.addItem('Install/Verify Booking Trigger', 'setupTrigger');
    adminMenu.addItem('Install Weekly Summary Trigger', 'setupWeeklySummaryTrigger');
    menu.addSubMenu(adminMenu);
  }
  menu.addToUi();
}

// --- Tier 3: Developer-Only Functions (NO MENU ITEMS) ---
// These functions are intentionally not added to any menu and must be run manually
// from the Apps Script editor by the developer. Can be found in 99_Admin_Utilities file.
//
// - saveSettingsToProperties()
// - _admin_checkSingleProperty()