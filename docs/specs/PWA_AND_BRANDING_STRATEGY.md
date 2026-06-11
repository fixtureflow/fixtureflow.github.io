# 🏸 FixtureFlow: PWA and Unified Branding Specification

This specification outlines the architecture, file paths, visual designs, and implementation details for the **FixtureFlow PWA Wrappers** and **Unified Branding Sync**.

---

## 1. Directory Structure (GitHub Pages Site)

To host the installable PWA shells and assets, we will organize your GitHub Pages repository (`fixtureflow.github.io/`) as follows:

```
fixtureflow.github.io/
├── assets/
│   └── images/
│       ├── logo.svg                 # Base corporate logo
│       ├── icon-courtflow.svg       # CourtFlow (Shuttlecock badge)
│       ├── icon-player.svg          # Leagues Player (User badge)
│       ├── icon-captain.svg         # Leagues Captain ("C" armband badge)
│       └── icon-club.svg            # Leagues Club Secretary (Gear/Key badge)
├── courtflow/
│   ├── index.html                   # Redirects / loads play/
│   └── play/
│       ├── index.html               # CourtFlow PWA wrapper shell
│       ├── manifest.json            # CourtFlow PWA manifest
│       └── sw.js                    # Service worker
└── leagues/
    ├── player/
    │   ├── index.html               # Leagues Player PWA wrapper shell
    │   ├── manifest.json            # Player PWA manifest
    │   └── sw.js                    # Service worker
    ├── captain/
    │   ├── index.html               # Leagues Captain PWA wrapper shell
    │   ├── manifest.json            # Captain PWA manifest
    │   └── sw.js                    # Service worker
    └── club/
        ├── index.html               # Leagues Club Secretary PWA wrapper shell
        ├── manifest.json            # Club PWA manifest
        └── sw.js                    # Service worker
```

---

## 2. FixtureFlow Semantic Design System

Rather than using a single theme color across all sub-products, FixtureFlow implements a **semantic design system** where visual accents align with the functional domain of the portal:

```
   [ Fixture (Leagues) ]   +   [ Flow (Sessions) ]   =   [ FixtureFlow ]
     Electric Violet             Vibrant Mint          Violet-to-Mint Gradient
      (Organization)                (Play)                  (Parent Brand)
```

### 2.1. Color Tokens by Domain

1. **🟣 Electric Violet (`#a78bfa` / `#6d28d9`) - The "Organization" Domain**
   * *Purpose*: Scheduling, team roster submissions, and fixture coordination.
   * *Active in*: Leagues Captain Portal, Leagues Hero Section.
2. **🟢 Vibrant Mint & Emerald (`#10b981` / `#047857`) - The "Active Play" Domain**
   * *Purpose*: Live court queue rotation, player standing check-ins, and active session play.
   * *Active in*: CourtFlow App, Leagues Player Portal, PWA Queue Wrappers.
3. **🌑 Obsidian & Slate (`#0b1329` / `#1e293b`) - The "System Administration" Domain**
   * *Purpose*: System settings, spreadsheet database management, and credential mapping.
   * *Active in*: Leagues Club Admin Portal.

---

## 3. Dynamic PWA Shell Wrapper (`index.html`)

All four PWA shells share a lightweight, unified HTML wrapper. It contains a full-screen, viewport-scaled `iframe` that dynamically injects the correct Google Apps Script Host ID based on the URL query string (`?h=...` or `?club=...`).

### The Dynamic Script
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <title>FixtureFlow Portal</title>
  <link rel="manifest" href="manifest.json">
  <meta name="theme-color" content="#0b1329">
  <style>
    body, html {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background-color: #0b1329;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    iframe {
      width: 100%;
      height: 100dvh; /* Dynamic viewport height prevents mobile address bar shifts */
      border: none;
      display: none; /* Hidden during loading */
    }
    .loader {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      width: 100%;
      height: 100%;
      color: #ffffff;
      gap: 16px;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(255, 255, 255, 0.1);
      border-top-color: #10b981;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  </style>
</head>
<body>

  <div class="loader" id="loading-screen">
    <div class="spinner"></div>
    <div style="font-weight: 500; font-size: 14px; letter-spacing: 0.05em;">CONNECTING TO PORTAL...</div>
  </div>

  <iframe id="app-frame" src=""></iframe>

  <script>
    // 1. Register Service Worker for offline capability
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js')
        .then(() => console.log('PWA Service Worker active'))
        .catch(err => console.error('SW Registration failed: ', err));
    }

    // 2. Parse Host ID and dynamically load iframe
    const urlParams = new URLSearchParams(window.location.search);
    const hostId = urlParams.get('h');
    const roleView = urlParams.get('view'); // For leagues forwarding

    if (hostId) {
      const frame = document.getElementById('app-frame');
      const loader = document.getElementById('loading-screen');
      
      // Construct targeted target URL
      let targetUrl = `https://script.google.com/macros/s/${hostId}/exec`;
      if (roleView) {
        targetUrl += `?view=${roleView}`;
      }

      frame.src = targetUrl;
      
      // Transition screen once iframe has fetched and painted
      frame.onload = () => {
        loader.style.display = 'none';
        frame.style.display = 'block';
      };
    } else {
      document.getElementById('loading-screen').innerHTML = 
        '<div style="color: #ef4444; font-weight: 600;">CONFIG ERROR: Missing host ID parameter (?h=...)</div>';
    }
  </script>
</body>
</html>
```

---

## 4. PWA Manifest Specifications (`manifest.json`)

Each of the 4 wrapper directories contains a custom `manifest.json` file. This tells the mobile browser how to display and identify the shortcut on the home screen.

### 4.1. CourtFlow Manifest (`courtflow/play/manifest.json`)
```json
{
  "name": "FixtureFlow: CourtFlow",
  "short_name": "CourtFlow",
  "start_url": "/courtflow/play/",
  "display": "standalone",
  "background_color": "#0b1329",
  "theme_color": "#10b981",
  "orientation": "any",
  "icons": [
    {
      "src": "/assets/images/icon-courtflow.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

### 4.2. Player Manifest (`leagues/player/manifest.json`)
```json
{
  "name": "FixtureFlow: Player Portal",
  "short_name": "FF Player",
  "start_url": "/leagues/player/",
  "display": "standalone",
  "background_color": "#0b1329",
  "theme_color": "#10b981",
  "orientation": "any",
  "icons": [
    {
      "src": "/assets/images/icon-player.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

### 4.3. Captain Manifest (`leagues/captain/manifest.json`)
```json
{
  "name": "FixtureFlow: Captain Portal",
  "short_name": "FF Captain",
  "start_url": "/leagues/captain/",
  "display": "standalone",
  "background_color": "#0b1329",
  "theme_color": "#a78bfa",
  "orientation": "any",
  "icons": [
    {
      "src": "/assets/images/icon-captain.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

### 4.4. Club Admin Manifest (`leagues/club/manifest.json`)
```json
{
  "name": "FixtureFlow: Club Admin",
  "short_name": "FF Club",
  "start_url": "/leagues/club/",
  "display": "standalone",
  "background_color": "#0b1329",
  "theme_color": "#0f172a",
  "orientation": "any",
  "icons": [
    {
      "src": "/assets/images/icon-club.svg",
      "sizes": "any",
      "type": "image/svg+xml",
      "purpose": "any"
    }
  ]
}
```

---

## 5. Vector SVG Role Icons Spec

The icons reuse the base FixtureFlow logo symbol (circular gradient with the "FF" grid mark) and overlay a distinct, color-coded badge in the bottom-right corner.

### 5.1. Base SVG Pattern (Gradient circle + FF mark)
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <defs>
    <linearGradient id="icon-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="40%" stop-color="#a78bfa"/>
      <stop offset="100%" stop-color="#10b981"/>
    </linearGradient>
  </defs>
  <!-- Background Brand circle -->
  <rect width="100" height="100" rx="50" fill="url(#icon-gradient)"/>
  <!-- Central FF bracket grid mark -->
  <path d="M22.5,32 H30.5 V68 H22.5 Z M28.6,47 H46.6 V53.9 H28.6 Z M28.6,32 H47.4 V38.9 H28.6 Z M52.6,32 H60.6 V68 H52.6 Z M58.7,47 H76.7 V53.9 H58.7 Z M58.7,32 H77.5 V38.9 H58.7 Z" fill="#ffffff"/>
  
  <!-- BADGE DEFINITIONS INSERTED HERE -->
</svg>
```

### 5.2. Role-Specific Badges

#### 🏸 CourtFlow Shuttlecock Badge (Mint Green)
Add this block inside the base SVG before the closing `</svg>` tag:
```xml
  <!-- Shuttlecock badge circle -->
  <circle cx="76" cy="76" r="18" fill="#0b1329" stroke="#ffffff" stroke-width="2.5"/>
  <!-- Shuttlecock lines (Vibrant Mint) -->
  <path d="M72,79 L78,79 L80,71 L70,71 Z M70,71 L74.5,67.5 L79,71" fill="none" stroke="#10b981" stroke-width="1.5" stroke-linejoin="round"/>
  <line x1="73.5" y1="79" x2="73" y2="71" stroke="#10b981" stroke-width="1"/>
  <line x1="76.5" y1="79" x2="77" y2="71" stroke="#10b981" stroke-width="1"/>
```

#### 👤 Player Avatar Badge (Emerald Green)
Add this block inside the base SVG:
```xml
  <!-- Player badge circle -->
  <circle cx="76" cy="76" r="18" fill="#0b1329" stroke="#ffffff" stroke-width="2.5"/>
  <!-- Avatar: head + shoulders (Emerald Green) -->
  <circle cx="75" cy="71.5" r="4.5" fill="#34d399"/>
  <path d="M67,81 C67,76.5 70,76.5 75,76.5 C80,76.5 83,76.5 83,81" fill="#34d399"/>
```

#### ⚓ Captain "C" Badge (Electric Violet)
Add this block inside the base SVG:
```xml
  <!-- Captain badge circle -->
  <circle cx="76" cy="76" r="18" fill="#0b1329" stroke="#ffffff" stroke-width="2.5"/>
  <!-- Bold heavy C (Electric Violet) -->
  <text x="75" y="77" font-family="Outfit, sans-serif" font-weight="900" font-size="17" fill="#a78bfa" text-anchor="middle" dominant-baseline="central">C</text>
```

#### 🔑 Club Admin Gear/Key Badge (Obsidian Slate)
Add this block inside the base SVG:
```xml
  <!-- Admin badge circle -->
  <circle cx="76" cy="76" r="18" fill="#0b1329" stroke="#ffffff" stroke-width="2.5"/>
  <!-- Key icon (Slate Blue / Grey) -->
  <circle cx="72" cy="73" r="3.5" fill="none" stroke="#94a3b8" stroke-width="2"/>
  <path d="M75,76 L80,81 M77.5,78.5 L79,77" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
```

---

## 6. Host Web App Branding Sync

To align the direct Web App interface when accessed via Google's `/exec` or `/dev` URLs, we will update the Host script's configuration:

### 6.1. CourtFlow Host (`Router_WebApp.js`)
*   **Action**: Set correct titles and badged favicon URLs:
    ```javascript
    return HtmlService.createHtmlOutput(result.data)
      .setTitle("CourtFlow Portal")
      .setFaviconUrl("https://fixtureflow.github.io/assets/images/icon-courtflow.png")
      .addMetaTag("viewport", "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    ```
*   **Dynamic Customization**:
    *   The app header dynamically renders the club's name from the `Club Name` setting in the spreadsheet, styled in the neutral primary text color.
    *   If a `Club Logo Link` is configured in the spreadsheet settings, the header dynamically converts standard Google Drive links to direct usercontent URLs and displays the club's official logo next to the name.
    *   The layout is kept 100% neutral and logo-free for the parent brand, maintaining a premium, white-labeled experience.

### 6.2. Leagues Host (Leagues repository)
*   **Action**: Update the Leagues host router to dynamically select the title and favicon based on the active `view` parameter:
    ```javascript
    const view = e.parameter.view;
    let title = "FixtureFlow Leagues";
    let favicon = "https://fixtureflow.github.io/favicon.ico";

    if (view === "player") {
      title = "FixtureFlow: Player Portal";
      favicon = "https://fixtureflow.github.io/assets/images/icon-player.svg";
    } else if (view === "captain") {
      title = "FixtureFlow: Captain Portal";
      favicon = "https://fixtureflow.github.io/assets/images/icon-captain.svg";
    } else {
      title = "FixtureFlow: Club Admin";
      favicon = "https://fixtureflow.github.io/assets/images/icon-club.svg";
    }

    return HtmlService.createHtmlOutput(result.data)
      .setTitle(title)
      .setFaviconUrl(favicon);
    ```

---

## 7. SEO & Crawl Prevention (Privacy Safeguards)

To prevent search engines (Googlebot, Bingbot, etc.) from indexing empty PWA wrapper templates or crawling private club link parameters (`?h=...`), we enforce two safeguards:

### 7.1. Master `robots.txt` (Website Root)
Create a `robots.txt` file in the root of `fixtureflow.github.io/` that explicitly blocks crawler access to the PWA and Leagues directories:
```
User-agent: *
Disallow: /courtflow/
Disallow: /leagues/
```

### 7.2. Robots Meta Tag (Inside HTML Head)
All dynamic wrapper `index.html` shells served under `/courtflow/` or `/leagues/` (detailed in Section 2) must include this tag in their `<head>`:
```html
<meta name="robots" content="noindex, nofollow">
```
