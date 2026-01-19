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
  return BadmintonLib.handleDoGet(e);
}