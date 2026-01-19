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
  // [HOST FIX] Save the URL to the HOST'S properties store, so the Host's "Sync" menu can find it.
  try {
    const url = ScriptApp.getService().getUrl();
    PropertiesService.getScriptProperties().setProperty('LAST_KNOWN_URL', url);
  } catch (err) {
    Logger.log('Could not save Web App URL in Host: ' + err.message);
  }

  return BadmintonLib.handleDoGet(e);
}