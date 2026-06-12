# Operational Instruction Manual

This manual provides instructions for deploying, updating, and operating the FixtureFlow website repository.

---

## 📬 1. Lead Generation Webhook Integration

The waitlist capture forms in `/courtflow/` connect directly to the shared CRM spreadsheet using a Google Apps Script Web App webhook.

*   **Endpoint URL:** `https://script.google.com/macros/s/AKfycbwjTqvUCCOr_nDYBLuInJJzIli_wbU7LWZA4lNSKsD5TEGHuY1iUaKvI5b2C9vs-Alo/exec`
*   **Method:** `POST`
*   **Request Payload (URL-encoded):**
    *   `name`: User's full name.
    *   `email`: User's email address.
    *   `club`: User's racket club/organization name.
*   **Segmentation Rules:**
    To separate coordinator leads from court manager leads inside the shared spreadsheet database, the CourtFlow form appends the segment parameter directly to the payload value:
    `queryParams.append('club', formData.get('club') + " (CourtFlow Interest)");`

---

## 💻 2. Local Preview & Testing

To test design changes, visual alignments, and interactive sandbox rotation routines locally:

### Using Python Static Server (Built-in on macOS):
Run this command from the repository root directory:
```bash
python3 -m http.server 8000
```
Then visit `http://localhost:8000/` in your browser.

### Using live-server (Auto-refreshes on edits):
If you have node/npm installed:
```bash
npx live-server
```

---

## 🧱 3. Adding a New Product Subpage

To expand the brand suite with a third product:

1.  **Create Directory:** Create a subdirectory at root (e.g. `/tournament/`).
2.  **Add index.html:** Create an `index.html` referencing global assets:
    ```html
    <head>
        <link rel="stylesheet" href="/assets/css/style.css">
        <script src="/assets/js/script.js" defer></script>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg">
    </head>
    ```
3.  **Override Product Colors:** In your local `<style>` tag, set your custom product colors to automatically repaint all buttons, checkboxes, and icons:
    ```css
    :root {
        --color-primary: #3b82f6; /* Custom theme color (e.g., Blue) */
        --color-primary-hover: #60a5fa;
        --color-primary-glow: rgba(59, 130, 246, 0.15);
    }
    ```
4.  **Register Navigation:** Update navigation links in root `/index.html`, `/ddlc/index.html`, and `/courtflow/index.html` headers.
5.  **Compile Map:** Run `python3 scripts/build_codebase_map.py` to index the new files.
