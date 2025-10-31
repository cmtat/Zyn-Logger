# Zyn Tracker

A lightweight web application for tracking when you use a Zyn pouch. Log entries from your phone or desktop, review and edit your history, explore charts of your usage, and export everything to a spreadsheet-friendly CSV.

## Features

- **Quick logging** – one-tap "log right now" button plus support for logging a custom time.
- **History management** – view every entry, edit timestamps, or delete mistakes.
- **Usage analytics** – interactive daily, weekly, and monthly charts powered by Chart.js.
- **CSV export** – download your entire history for use in Excel or any spreadsheet tool.

## Getting started

```bash
npm install
npm start
```

Then open <http://localhost:3000> in your browser.

The app stores data locally in a JSON file at `data/logs.json`. The file is ignored by Git so your personal log stays private.

## Project structure

```
.
├── data/
├── public/
│   ├── analytics.html
│   ├── index.html
│   ├── logs.html
│   ├── styles.css
│   └── js/
│       ├── analytics.js
│       ├── log-entry.js
│       └── logs.js
└── server.js
```

## API overview

- `GET /api/logs` – return every log entry.
- `POST /api/logs` – create a new log. Body: `{ "timestamp": "2024-01-01T12:34:56.000Z" }`.
- `PUT /api/logs/:id` – update a log's timestamp.
- `DELETE /api/logs/:id` – remove a log.
- `GET /api/stats?window=30` – aggregated counts for charts.
- `GET /api/export` – download all logs as CSV.

Feel free to tweak the UI or extend the data model (for example, adding notes or pouch strength) to fit your routine.
