/*******************************************************************
 * Match Admin System: Web App - Host Wrapper
 * 
 * Responsible for all logic related to serving the web application.
 * DELEGATES ALL LOGIC TO THE LIBRARY.
 * 
 * HELPER FUNCTIONS are now in the Library.
 *******************************************************************/
//==============================================================
// 1️⃣ WEB APP - FRONTEND WRAPPER
//==============================================================

/**
 * Serves the main web app (index.html).
 * V2: Now reads the 'Enable Away Booking' setting and passes it to the template.
 * Also has secret backdoor.
 */
function doGet(e) {
  return BadmintonLib.handleDoGet(e);
}