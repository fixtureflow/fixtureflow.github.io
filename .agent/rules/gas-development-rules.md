---
trigger: always_on
---

# Google Apps Script (GAS) Development Rules

## 1. Environment Constraints (CRITICAL)
- **No Modules:** Google Apps Script runs in a global scope. DO NOT use `module.exports`, `require()`, or `import/export`. All functions in all files are available globally.
- **File Structure:** We are splitting a monolithic script into modules locally (e.g., `EmailService.js`, `Helpers.js`), but CLASP flattens them upon push. Treat separate files as if they are one big file.

## 2. Emailing Protocol (MANDATORY)
- **NEVER** call `MailApp.sendEmail` or `GmailApp.sendEmail` directly.
- **ALWAYS** use the centralized helper: 
  `_sendClubEmail(recipient, subject, htmlBody, settings, [plainBody])`
- This helper handles:
  - Branding ("Mount Pleasant Match Secretary")
  - Reply-To headers
  - Safety (Test Mode redirection)

## 3. Configuration & Hardcoding
- **No Hardcoded Sheet Names:** Never use strings like "Fixtures" or "Opponent Info".
- **Use the Config:** Always reference the global `CONFIG` object.
  - Example: `ss.getSheetByName(CONFIG.SHEETS.FIXTURES)`

## 4. Date & Time Handling
- GAS Timezones can be tricky. Always use `Session.getScriptTimeZone()` when formatting.
- Use the existing helper `formatDateForSheet(dateObj)` for standard formatting.

## 5. Logging & Error Handling
- Use `Logger.log()` for debugging (not `console.log`).
- Every entry-point function (triggers/web app) must be wrapped in a `try/catch` block that logs the stack trace.

## 6. Documentation
- All helper functions must start with a JSDoc block explaining inputs/outputs.
- Mark internal helpers with an underscore suffix if they are not meant to be triggered directly (e.g., `getClubSettings_`).

## 7. HTML Templates (Scriptlets)
- This project uses Google Apps Script HTML Templates.
- **DO NOT** format or change tags that look like `<? ... ?>` or `<?= ... ?>`.
- Treat these as server-side code blocks embedded in HTML.
