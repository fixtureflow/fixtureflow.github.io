/*******************************************************************
 * Match Admin System: Web App - Frontend & Data Services
 * 
 * Responsible for all logic related to serving the web application
 * and its data, including the main doGet() and all cached data-
 * getter functions called by the UI.
 * 
 * HELPER FUNCTIONS have been moved to `1_WebApp_Frontend_Helpers.js`.
 *******************************************************************/
//==============================================================
// 1️⃣ WEB APP - FRONTEND & DATA SERVICES
//==============================================================

/**
 * Serves the main web app (index.html).
 * V2: Now reads the 'Enable Away Booking' setting and passes it to the template.
 * Also has secret backdoor.
 */
function doGet(e) {
  // Every time the web app is loaded, have it save its own URL to the script's memory.
  try {
    PropertiesService.getScriptProperties().setProperty('LAST_KNOWN_URL', ScriptApp.getService().getUrl());
  } catch(propError) {
    Logger.log(`Minor error: Could not save web app URL to properties. ${propError.message}`);
  }

  // This block is REQUIRED to make your "?action=clear" work.
  if (e && e.parameter && e.parameter.action === 'clear') {
    try {
      const keysToClear = [
        'CLUB_SETTINGS', 'OUR_TEAMS', 'SEASON_MONTHS', 
        'OPPONENT_CLUBS', 'PENDING_FIXTURES', 'PENDING_AWAY_FIXTURES'
      ];
      CacheService.getScriptCache().removeAll(keysToClear);
      return ContentService.createTextOutput("SUCCESS: The web application cache has been cleared. You can now close this tab.");
    } catch (err) {
      return ContentService.createTextOutput(`ERROR: Could not clear cache. ${err.message}`);
    }
  }

  const settings = getClubSettings();
  const template = HtmlService.createTemplateFromFile('index');
  template.clubName = settings['Club Name'] || 'Match Booking Portal';
  template.email = settings['Match Secretary Email'] || '';
  
  // This line correctly passes the variable to the frontend.
  const enableAway = String(settings['Enable Away Booking'] || '').trim().toUpperCase();
  template.awayBookingEnabled = (enableAway === 'TRUE');
  
  return template.evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0');
}