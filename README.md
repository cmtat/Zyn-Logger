# Zyn Tracker

A lightweight, fully static web app for tracking when you pop in a Zyn pouch. Open it from your phone or desktop, log the current moment or a past time, tidy up your history, explore charts, and export everything to a spreadsheet-ready CSV.

## Features

- **Quick logging** – one-tap "log right now" button plus support for logging any specific time.
- **History management** – edit or delete any entry directly in your browser.
- **Usage analytics** – daily, weekly, and monthly charts powered by Chart.js.
- **CSV export** – download every log for Excel, Google Sheets, or Numbers.
- **Optional GitHub sync** – push your log file to a repository so every device sees the same history.

## Data storage

By default everything lives in your browser’s `localStorage`, scoped to the device and browser you’re using. No accounts, no servers, and nothing leaves your machine unless you export it.

If you want the data to live in GitHub instead, open the **Settings** dialog in the app, paste a personal access token, and the app will read/write a JSON file in your repository. The token is stored locally in the browser so only you can sync.

### GitHub sync setup

1. Create (or pick) a repository you control.
2. Generate a **classic** personal access token with the `repo` scope:  
   <https://github.com/settings/tokens/new?scopes=repo>
3. In the app, open **Settings** (top right) and enter:
   - Owner/org name (e.g. `octocat`)
   - Repository (e.g. `zyn-tracker`)
   - Branch (defaults to `main`)
   - File path (defaults to `data/logs.json`)
   - The personal access token you just created
4. Save. The app fetches the remote JSON (creating it if missing) and keeps your local copy in sync after every change.

Only the configured repository receives updates. If you change the file manually on GitHub, use **Settings → Refresh from GitHub** to pull the latest copy into the app.

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

GitHub Pages can serve from either:

- `main` (root or the `/docs` folder), or
- a dedicated `gh-pages` branch

Pick whichever workflow fits your repo. For a simple site, the usual approach is:

1. Commit the `public/` folder to `main` (or copy its contents into the branch you publish).
2. In your repository settings, head to **Pages**, choose the branch (`main` or `gh-pages`) and the folder (`/` for the root, or `/docs`).
3. Save the setting and wait for the green deployment check.
4. Visit `https://<username>.github.io/<repo>/`.

If you removed a previous site, re-enable Pages with the branch/folder you prefer (for example, `gh-pages` if you keep generated files there, or `main` if you keep `public/` at the repo root).

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
