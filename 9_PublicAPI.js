/*******************************************************************
 * Match Admin System: Public API (Library Entry Points)
 * 
 * This file defines the public interface of the system. 
 * When this project is deployed as a Library, these are the ONLY 
 * functions that should be called by the host script.
 * 
 * Each function here acts as a wrapper that:
 * 1. Injects dependencies (like Settings).
 * 2. Calls the internal implementation (suffixed with _).
 *******************************************************************/

//==============================================================
// 1. WEB APP API (Called by Frontend)
//==============================================================

/**
 * Gets the club settings.
 * @returns {Object} The settings object.
 */
function getClubSettings() {
  return getClubSettings_();
}

/**
 * Gets the list of "Our Teams".
 * @returns {Object[]} List of teams.
 */
function getOurTeams() {
  const settings = getClubSettings_();
  // Call the internal cached getter, passing settings if needed
  // Note: getOurTeams_ in Helpers handles caching internally, but we can inject if we refactor further.
  // For now, we delegate to the existing public-ish helper which we will rename/move logic from.
  // actually, getOurTeams in Helpers IS the public one. We will move it here.
  return getOurTeams_Public_();
}

/**
 * Gets valid season months.
 * @returns {Object[]} List of months.
 */
function getValidSeasonMonths() {
  return getValidSeasonMonths_Public_();
}

/**
 * Gets opponent clubs.
 * @returns {Object[]} List of clubs.
 */
function getOpponentClubs() {
  return getOpponentClubs_Public_();
}

/**
 * Gets pending home fixtures.
 * @returns {Object} Map of fixtures.
 */
function getPendingHomeFixtures() {
  return getPendingHomeFixtures_();
}

/**
 * Gets pending away fixtures.
 * @returns {Object} Map of fixtures.
 */
function getPendingAwayFixtures() {
  const settings = getClubSettings_();
  return getPendingAwayFixtures_(settings);
}

/**
 * Gets time slots for a date.
 * @param {string} dateStr "yyyy-MM-dd"
 * @returns {string[]} Array of times.
 */
function getTimeSlotsForDate(dateStr) {
  const settings = getClubSettings_();
  return getTimeSlotsForDate_(dateStr, settings);
}

/**
 * Finds available dates for a HOME match.
 * @param {string} teamName 
 * @param {number} month 
 * @param {number} year 
 * @returns {string[]} Available dates.
 */
function findAvailableDatesForTeam(teamName, month, year) {
  const settings = getClubSettings_();
  return findAvailableDatesForTeam_(teamName, month, year, settings);
}

/**
 * Finds available dates for an AWAY match.
 * @param {string} teamName 
 * @param {number} month 
 * @param {number} year 
 * @returns {string[]} Available dates.
 */
function findAvailableDatesForAwayMatch(teamName, month, year) {
  const settings = getClubSettings_();
  return findAvailableDatesForAwayMatch_(teamName, month, year, settings);
}

/**
 * Submits a booking request.
 * @param {Object} booking 
 * @returns {string} "Success" or error.
 */
function submitBookingRequest(booking) {
  const settings = getClubSettings_();
  return submitBookingRequest_(booking, settings);
}

/**
 * Submits an away booking proposal.
 * @param {Object} proposal 
 * @returns {string} "Success" or error.
 */
function submitAwayBookingRequest(proposal) {
  const settings = getClubSettings_();
  return submitAwayBookingRequest_(proposal, settings);
}

//==============================================================
// 2. ADMIN API (Called by Triggers/Menu)
//==============================================================

/**
 * Syncs fixtures to availability.
 * @param {boolean} silent 
 * @returns {Object} Result summary.
 */
function fillAvailabilityX(silent = false) {
  const settings = getClubSettings_();
  return fillAvailabilityX_(silent, settings);
}

/**
 * Processes form submissions.
 */
function processSubmissions() {
  const settings = getClubSettings_();
  return processSubmissions_(settings);
}

/**
 * Sends the weekly match summary.
 */
function sendWeeklyMatchSummary() {
  const settings = getClubSettings_();
  return sendWeeklyMatchSummary_(settings);
}

/**
 * Sends an opponent summary email.
 * @param {string} opponentName 
 */
function sendOpponentSummaryEmail(opponentName) {
  const settings = getClubSettings_();
  return sendOpponentSummaryEmail_(opponentName, settings);
}

/**
 * Processes a booking change (Trigger Entry Point).
 * @param {Object} e 
 * @param {string} action 
 * @param {boolean} isHome 
 */
function _processBookingChange(e, action, isHome) {
  const settings = getClubSettings_();
  return _processBookingChange_(e, action, isHome, settings);
}
