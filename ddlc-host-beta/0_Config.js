/*******************************************************************
 * Match Admin System: Host Configuration & Setup
 * 
 * Contains the foundational configuration for the application,
 * including menus and trigger installation.
 * MOST LOGIC DELEGATED TO LIBRARY.
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
    SETTING_NAME: 'Setting Name',
    SETTING_VALUE: 'Setting Value',
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
  HOME_AWAY_OPTIONS: {
    HOME: 'HOME',
    AWAY: 'AWAY'
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
    LOADING_SPINNER: 'LoadingSpinner',
    SHUTTLE_ALLOCATION: 'ShuttleAllocationEmail'
  },
  TEAM_SHEET: {
    ALLOWED_DAYS_COL: 2, // Column C (NEW)
    PLAYER_START_COL: 3, // Column D (WAS 2)
    PLAYER_END_COL: 8    // Column H (WAS 7) (this is for slice(2, 7))
  },
  SETTINGS_KEYS: {
    CLUB_NAME: 'Club Name',
    MATCH_SECRETARY_EMAIL: 'Match Secretary Email',
    MATCH_SECRETARY_NAME: 'Match Secretary Name', // [NEW] For email signature
    SHUTTLE_MANAGER_EMAIL: 'Shuttle Manager Email', // [NEW] Optional split config
    SHUTTLE_MANAGER_NAME: 'Shuttle Manager Name', // [NEW] For email greeting
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
 * Menu Structure:
 * 1. General User Functions: Day-to-day operations (Sync, Process, Email).
 * 2. Setup & Config: Validation triggers and Web App URL sync.
 * 3. Admin Tools: Restricted functions for the Developer (Dev Mode).
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
  
  // --- Tier 1.5: Setup & Maintenance (Visible to ALL, for initial setup) ---
  menu.addSeparator();
  const setupMenu = ui.createMenu('Setup & Config');
  setupMenu.addItem('1. Install/Verify Booking Trigger', 'setupTrigger');
  setupMenu.addItem('2. Install Weekly Summary Trigger', 'setupWeeklySummaryTrigger');
  setupMenu.addItem('3. Sync Web App URL to Settings', 'updateWebAppUrl');
  menu.addSubMenu(setupMenu);

  // --- Tier 2: Hidden Admin Tools (Visible only to Developer) ---
  if (Session.getEffectiveUser().getEmail() === DEVELOPER_EMAIL) {
    menu.addSeparator();
    const adminMenu = ui.createMenu('⚠️ Admin Tools (Dev Only)');
    adminMenu.addItem('Clear Player\'s Unavailability (U)', 'clearPlayerUnavailability_menu');
    adminMenu.addItem("!! Reset ALL Player Availability !!", 'showResetAllDialog')
    adminMenu.addSeparator();
    adminMenu.addItem('Clear Web App Cache', 'clearCache');
    adminMenu.addItem('🔒 Lock Down Settings', 'lockDownSettings_menu');
    menu.addSubMenu(adminMenu);
  }
  menu.addToUi();
}
