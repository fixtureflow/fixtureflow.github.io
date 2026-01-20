/**
 * WRAPPERS for Web App Backend Functions.
 * These functions must be exposed in the Host Script so that google.script.run can call them.
 */

function getClubSettings() {
  return BadmintonLib.getClubSettings();
}

function getOurTeams() {
  return BadmintonLib.getOurTeams();
}

function getValidSeasonMonths() {
  return BadmintonLib.getValidSeasonMonths();
}

function getOpponentClubs() {
  return BadmintonLib.getOpponentClubs();
}

function getPendingHomeFixtures() {
  return BadmintonLib.getPendingHomeFixtures();
}

function getPendingAwayFixtures() {
  return BadmintonLib.getPendingAwayFixtures();
}

function getTimeSlotsForDate(dateStr) {
  return BadmintonLib.getTimeSlotsForDate(dateStr);
}

function findAvailableDatesForTeam(teamName, month, year) {
  return BadmintonLib.findAvailableDatesForTeam(teamName, month, year);
}

function findAvailableDatesForAwayMatch(teamName, month, year) {
  return BadmintonLib.findAvailableDatesForAwayMatch(teamName, month, year);
}

function submitBookingRequest(booking) {
  return BadmintonLib.submitBookingRequest(booking);
}

function submitAwayBookingRequest(proposal) {
  return BadmintonLib.submitAwayBookingRequest(proposal);
}

// --- Admin / Utilities ---

function clearCache() {
  return BadmintonLib.clearCache();
}

function processSubmissions() {
  return BadmintonLib.processSubmissions();
}

function sendWeeklyMatchSummary() {
  return BadmintonLib.sendWeeklyMatchSummary();
}

function sendOpponentSummaryEmail(opponentName) {
  return BadmintonLib.sendOpponentSummaryEmail(opponentName);
}

function getClearablePlayerList() {
  return BadmintonLib.getClearablePlayerList();
}

function clearPlayerUnavailability(playerName) {
  return BadmintonLib.clearPlayerUnavailability(playerName);
}
