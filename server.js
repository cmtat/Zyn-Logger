const fs = require('fs');
const path = require('path');
const express = require('express');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'logs.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    return [];
  }
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed;
    }
  } catch (error) {
    console.error('Failed to read data file, starting fresh.', error);
  }
  return [];
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let logs = loadData();
let nextId = logs.reduce((max, log) => Math.max(max, Number(log.id) || 0), 0) + 1;

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function isValidTimestamp(value) {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

function findLogIndex(id) {
  return logs.findIndex((log) => log.id === id);
}

function toISO(value) {
  return new Date(value).toISOString();
}

app.get('/api/logs', (_req, res) => {
  const sorted = [...logs].sort(
    (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
  );
  res.json(sorted);
});

app.post('/api/logs', (req, res) => {
  const { timestamp } = req.body;
  if (!isValidTimestamp(timestamp)) {
    return res.status(400).json({ error: 'Invalid timestamp' });
  }
  const log = { id: nextId++, timestamp: toISO(timestamp) };
  logs.push(log);
  saveData(logs);
  res.status(201).json(log);
});

app.put('/api/logs/:id', (req, res) => {
  const id = Number(req.params.id);
  const { timestamp } = req.body;

  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  if (!isValidTimestamp(timestamp)) {
    return res.status(400).json({ error: 'Invalid timestamp' });
  }

  const index = findLogIndex(id);
  if (index === -1) {
    return res.status(404).json({ error: 'Log not found' });
  }

  logs[index] = { ...logs[index], timestamp: toISO(timestamp) };
  saveData(logs);
  res.json(logs[index]);
});

app.delete('/api/logs/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'Invalid id' });
  }
  const index = findLogIndex(id);
  if (index === -1) {
    return res.status(404).json({ error: 'Log not found' });
  }
  logs.splice(index, 1);
  saveData(logs);
  res.status(204).end();
});

function groupBy(arr, keyFn) {
  return arr.reduce((acc, item) => {
    const key = keyFn(item);
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map());
}

function dailyStats(windowDays) {
  const now = Date.now();
  const cutoff = now - windowDays * 24 * 60 * 60 * 1000;
  const filtered = logs.filter((log) => new Date(log.timestamp).getTime() >= cutoff);
  const grouped = groupBy(filtered, (log) => log.timestamp.slice(0, 10));
  return Array.from(grouped.entries())
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => new Date(a.period) - new Date(b.period));
}

function getWeekKey(date) {
  const tmp = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = tmp.getUTCDay() || 7;
  tmp.setUTCDate(tmp.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((tmp - yearStart) / 86400000 + 1) / 7);
  return `${tmp.getUTCFullYear()}-${String(weekNo).padStart(2, '0')}`;
}

function weeklyStats() {
  const grouped = groupBy(logs, (log) => {
    const date = new Date(log.timestamp);
    return getWeekKey(
      new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    );
  });
  return Array.from(grouped.entries())
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => (a.period > b.period ? 1 : -1));
}

function monthlyStats() {
  const grouped = groupBy(logs, (log) => log.timestamp.slice(0, 7));
  return Array.from(grouped.entries())
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => (a.period > b.period ? 1 : -1));
}

app.get('/api/stats', (req, res) => {
  const { window = '30' } = req.query;
  const days = Number.parseInt(window, 10);
  const windowDays = Number.isNaN(days) ? 30 : Math.max(1, Math.min(days, 365));

  res.json({
    daily: dailyStats(windowDays),
    weekly: weeklyStats(),
    monthly: monthlyStats(),
  });
});

app.get('/api/export', (_req, res) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="zyn-logs.csv"');
  const sorted = [...logs].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const header = 'id,timestamp\n';
  const body = sorted.map((log) => `${log.id},${log.timestamp}`).join('\n');
  res.send(header + body);
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Zyn tracker server running at http://localhost:${PORT}`);
});
