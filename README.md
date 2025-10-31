# Zyn Tracker

A lightweight, fully static web app for tracking when you pop in a Zyn pouch. Open it from your phone or desktop, log the current moment or a past time, tidy up your history, explore charts, and export everything to a spreadsheet-ready CSV.

## Features

- **Quick logging** – one-tap "log right now" button plus support for logging any specific time.
- **Local history management** – edit or delete any entry directly in your browser.
- **Usage analytics** – daily, weekly, and monthly charts powered by Chart.js.
- **CSV export** – download every log for Excel, Google Sheets, or Numbers.

## Data storage

All data lives in your browser’s `localStorage`, scoped to the device and browser you’re using. No accounts, no servers, and nothing leaves your machine unless you export it. If you want to keep multiple devices in sync, export from one and import manually into another (or copy the `localStorage` data).

## Run it locally

Because the site is static, you can open `public/index.html` directly or serve the folder with any static file server. Two easy options:

```bash
# Option 1 – use the existing Express helper
npm install
npm start

# Option 2 – use a lightweight static server (no Node app required)
npx serve public
```

Then visit <http://localhost:3000> (or the URL shown by your static server) and start logging.

## Deploy to GitHub Pages

1. Push the contents of `public/` to the branch GitHub Pages serves from (often `main` or `gh-pages`).
2. Ensure the repository is configured for GitHub Pages in the repo settings.
3. Navigate to the published URL (e.g., `https://<username>.github.io/<repo>/`).

Because everything is static and self-contained, no additional build or backend configuration is needed.

## Project structure

```
.
├── public/
│   ├── analytics.html
│   ├── index.html
│   ├── logs.html
│   ├── styles.css
│   └── js/
│       ├── analytics.js
│       ├── log-entry.js
│       ├── logs.js
│       └── storage.js
├── package.json
└── server.js      # Optional helper for local development
```

Feel free to extend the UI or data model (for example, adding pouch strength or notes) to suit your routine.
