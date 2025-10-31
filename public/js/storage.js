const STORAGE_KEY = 'zyn-tracker/logs';
const NEXT_ID_KEY = 'zyn-tracker/next-id';

const hasWindow = typeof window !== 'undefined';
const localStorageRef = hasWindow ? window.localStorage : null;
let storageAvailable = Boolean(localStorageRef);

if (storageAvailable) {
  try {
    const testKey = `${STORAGE_KEY}__test__`;
    localStorageRef.setItem(testKey, '1');
    localStorageRef.removeItem(testKey);
  } catch (_error) {
    storageAvailable = false;
  }
}

const listeners = new Set();
let cache = [];
let nextId = 1;

function sanitize(entry) {
  if (!entry) return null;
  const id = Number(entry.id);
  const time = new Date(entry.timestamp);
  if (!Number.isFinite(id) || Number.isNaN(time.getTime())) {
    return null;
  }
  return { id, timestamp: time.toISOString() };
}

function readFromStorage() {
  if (!storageAvailable) {
    return [];
  }
  try {
    const raw = localStorageRef.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitize).filter(Boolean);
  } catch (_error) {
    storageAvailable = false;
    return [];
  }
}

function persistAll() {
  if (storageAvailable) {
    try {
      localStorageRef.setItem(STORAGE_KEY, JSON.stringify(cache));
      localStorageRef.setItem(NEXT_ID_KEY, String(nextId));
    } catch (_error) {
      storageAvailable = false;
    }
  }
  notify();
}

function loadInitial() {
  cache = readFromStorage();
  const storedNext = storageAvailable
    ? Number.parseInt(localStorageRef.getItem(NEXT_ID_KEY) || '', 10)
    : Number.NaN;
  const maxId = cache.reduce((max, log) => Math.max(max, log.id), 0);
  if (Number.isInteger(storedNext) && storedNext > maxId) {
    nextId = storedNext;
  } else {
    nextId = maxId + 1;
    if (storageAvailable) {
      try {
        localStorageRef.setItem(NEXT_ID_KEY, String(nextId));
      } catch (_error) {
        storageAvailable = false;
      }
    }
  }
}

function notify() {
  const snapshot = getLogs();
  listeners.forEach((listener) => listener(snapshot));
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(getLogs());
  return () => listeners.delete(listener);
}

function ensureIsoTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid timestamp. Please pick a valid date and time.');
  }
  return date.toISOString();
}

export function getLogs() {
  return [...cache].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function addLog(timestamp) {
  const iso = ensureIsoTimestamp(timestamp);
  const log = { id: nextId++, timestamp: iso };
  cache.push(log);
  persistAll();
  return log;
}

export function updateLog(id, timestamp) {
  const iso = ensureIsoTimestamp(timestamp);
  const numericId = Number(id);
  const index = cache.findIndex((entry) => entry.id === numericId);
  if (index === -1) {
    throw new Error('Log not found.');
  }
  cache[index] = { ...cache[index], timestamp: iso };
  persistAll();
  return cache[index];
}

export function removeLog(id) {
  const numericId = Number(id);
  const index = cache.findIndex((entry) => entry.id === numericId);
  if (index === -1) {
    throw new Error('Log not found.');
  }
  cache.splice(index, 1);
  persistAll();
}

export function buildCsv() {
  const rows = [...cache].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  const header = 'id,timestamp';
  const body = rows.map((log) => `${log.id},${log.timestamp}`);
  return [header, ...body].join('\n');
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

function pad(value) {
  return String(value).padStart(2, '0');
}

function dailyStats(logs, windowDays) {
  const cutoff = Date.now() - windowDays * DAY_IN_MS;
  const grouped = new Map();

  logs.forEach((log) => {
    const time = new Date(log.timestamp).getTime();
    if (time < cutoff) return;
    const date = new Date(time);
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate()
    )}`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });

  return Array.from(grouped.entries())
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => new Date(a.period) - new Date(b.period));
}

function getWeekKey(date) {
  const utc = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  );
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((utc - yearStart) / DAY_IN_MS + 1) / 7);
  return `${utc.getUTCFullYear()}-${pad(weekNo)}`;
}

function weeklyStats(logs) {
  const grouped = new Map();
  logs.forEach((log) => {
    const date = new Date(log.timestamp);
    const key = getWeekKey(date);
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });

  return Array.from(grouped.entries())
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => (a.period > b.period ? 1 : -1));
}

function monthlyStats(logs) {
  const grouped = new Map();
  logs.forEach((log) => {
    const date = new Date(log.timestamp);
    const key = `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });

  return Array.from(grouped.entries())
    .map(([period, count]) => ({ period, count }))
    .sort((a, b) => (a.period > b.period ? 1 : -1));
}

export function calculateStats(windowDays = 30) {
  const parsed = Number.parseInt(windowDays, 10);
  const range = Number.isNaN(parsed)
    ? 30
    : Math.max(1, Math.min(parsed, 365));
  const logs = getLogs();
  return {
    daily: dailyStats(logs, range),
    weekly: weeklyStats(logs),
    monthly: monthlyStats(logs),
  };
}

if (hasWindow) {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY || event.key === NEXT_ID_KEY) {
      cache = readFromStorage();
      const storedNext = storageAvailable
        ? Number.parseInt(localStorageRef.getItem(NEXT_ID_KEY) || '', 10)
        : Number.NaN;
      const maxId = cache.reduce((max, log) => Math.max(max, log.id), 0);
      nextId = Number.isInteger(storedNext) && storedNext > maxId
        ? storedNext
        : maxId + 1;
      notify();
    }
  });
}

loadInitial();
