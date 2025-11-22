---
trigger: always_on
---

# Google Apps Script (GAS) Development Rules

## 1. Environment Constraints (CRITICAL)
- **No Modules:** Google Apps Script runs in a global scope. DO NOT use `module.exports`, `require()`, or `import/export`. All functions in all files are available globally.
- **File Structure:** We are splitting a monolithic script into modules locally (e.g., `EmailService.js`, `Helpers.js`), but CLASP flattens them upon push. Treat separate files as if they are one big file.
- **Minimize Globals:** Avoid global variables outside of `CONFIG`. Globals are re-evaluated on every execution, slowing down start-up.

## 2. Emailing Protocol (MANDATORY)
- **NEVER** call `MailApp.sendEmail` or `GmailApp.sendEmail` directly.
- **ALWAYS** use the centralized helper: 
  `_sendClubEmail(recipient, subject, htmlBody, settings, [plainBody])`
- This helper handles:
  - Branding ("Mount Pleasant Match Secretary")
  - Reply-To headers
  - Safety (Test Mode redirection)

## 3. Configuration & Secrets
- **No Hardcoded Sheet Names:** Never use strings like "Fixtures" or "Opponent Info".
- **Use the Config:** Always reference the global `CONFIG` object.
  - Example: `ss.getSheetByName(CONFIG.SHEETS.FIXTURES)`
- **Secrets Management:** Store sensitive data (API keys, passwords, developer emails) in `PropertiesService.getScriptProperties()`, NEVER in code or visible sheets.

## 4. Date & Time Handling
- GAS Timezones can be tricky. Always use `Session.getScriptTimeZone()` when formatting.
- Use the existing helper `formatDateForSheet(dateObj)` for standard formatting.

## 5. Concurrency & Safety (CRITICAL)
- **LockService is Mandatory:** Any function that writes to a sheet (bookings, status updates) MUST use `LockService` to prevent race conditions.
- **Destructive Actions:** Operations that delete or overwrite large amounts of data must require an explicit confirmation string (e.g., "CONFIRM NUKE").

## 6. Logging & Error Handling
- Use `Logger.log()` for debugging (not `console.log`).
- Every entry-point function (triggers/web app) must be wrapped in a `try/catch` block that logs the stack trace.

## 7. Documentation & Libraries
- **JSDoc:** All helper functions must start with a JSDoc block explaining inputs/outputs.
- **Private Helpers:** Mark internal helpers with an underscore suffix (e.g., `getClubSettings_`).
- **Dependency Injection:** Library-ready functions should accept dependencies (like `ss` or `settings`) as arguments rather than relying on global state.

## 8. HTML Templates (Scriptlets)
- **Sanitization:** By default, use `<?= var ?>` to escape output. Only use `<?!= var ?>` if you are certain the content is safe HTML.
- **Formatting:** Do not auto-format tags that look like `<? ... ?>`.