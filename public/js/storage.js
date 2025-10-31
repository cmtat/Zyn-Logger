const STORAGE_KEY = 'zyn-tracker/logs';
const NEXT_ID_KEY = 'zyn-tracker/next-id';
const CONFIG_KEY = 'zyn-tracker/github-config';

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
const syncListeners = new Set();

let cache = [];
let nextId = 1;
let config = loadConfigFromStorage();
let remoteSha = null;
let initializingPromise = null;

const initialSyncState = {
  enabled: Boolean(config?.token),
  status: 'idle',
  message: '',
  lastSyncedAt: null,
};

let syncState = { ...initialSyncState };

function notify() {
  const snapshot = getLogs();
  listeners.forEach((listener) => listener(snapshot));
}

function notifySync() {
  const snapshot = { ...syncState };
  syncListeners.forEach((listener) => listener(snapshot));
}

function setSyncState(state) {
  syncState = { ...syncState, ...state };
  notifySync();
}

function resetSyncState() {
  syncState = { ...initialSyncState, enabled: Boolean(config?.token) };
  notifySync();
}

function sanitize(entry) {
  if (!entry) return null;
  const id = Number(entry.id);
  const time = new Date(entry.timestamp);
  if (!Number.isFinite(id) || Number.isNaN(time.getTime())) {
    return null;
  }
  return { id, timestamp: time.toISOString() };
}

function loadLocalData() {
  if (!storageAvailable) {
    cache = [];
    nextId = 1;
    return;
  }
  try {
    const raw = localStorageRef.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (Array.isArray(parsed)) {
      cache = parsed.map(sanitize).filter(Boolean);
    } else {
      cache = [];
    }
  } catch (_error) {
    cache = [];
  }

  try {
    const storedNext = storageAvailable
      ? Number.parseInt(localStorageRef.getItem(NEXT_ID_KEY) || '', 10)
      : Number.NaN;
    const maxId = cache.reduce((max, log) => Math.max(max, log.id), 0);
    if (Number.isInteger(storedNext) && storedNext > maxId) {
      nextId = storedNext;
    } else {
      nextId = maxId + 1;
    }
  } catch (_error) {
    const maxId = cache.reduce((max, log) => Math.max(max, log.id), 0);
    nextId = maxId + 1;
  }
}

function saveLocalData(data, nextIdValue) {
  if (!storageAvailable) return;
  try {
    localStorageRef.setItem(STORAGE_KEY, JSON.stringify(data));
    localStorageRef.setItem(NEXT_ID_KEY, String(nextIdValue));
  } catch (_error) {
    storageAvailable = false;
  }
}

function loadConfigFromStorage() {
  if (!storageAvailable) return null;
  try {
    const raw = localStorageRef.getItem(CONFIG_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      owner: (parsed.owner || '').trim(),
      repo: (parsed.repo || '').trim(),
      branch: parsed.branch ? parsed.branch.trim() : 'main',
      path: parsed.path ? parsed.path.trim() : 'data/logs.json',
      token: parsed.token || '',
    };
  } catch (_error) {
    return null;
  }
}

function storeConfig(nextConfig) {
  config = nextConfig;
  if (storageAvailable) {
    if (nextConfig) {
      localStorageRef.setItem(CONFIG_KEY, JSON.stringify(nextConfig));
    } else {
      localStorageRef.removeItem(CONFIG_KEY);
    }
  }
}

const textEncoder = hasWindow ? new TextEncoder() : null;
const textDecoder = hasWindow ? new TextDecoder() : null;

function base64Encode(value) {
  if (!hasWindow || !textEncoder) return '';
  const bytes = textEncoder.encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return window.btoa(binary);
}

function base64Decode(value) {
  if (!hasWindow || !textDecoder) return '';
  const binary = window.atob(value || '');
  const bytes = Uint8Array.from(
    Array.from(binary).map((char) => char.charCodeAt(0))
  );
  return textDecoder.decode(bytes);
}

function githubHeaders() {
  if (!config?.token) {
    throw new Error('GitHub token not configured.');
  }
  return {
    Authorization: `Bearer ${config.token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'Zyn-Tracker',
  };
}

function githubContentUrl() {
  if (!config?.owner || !config?.repo) {
    throw new Error('GitHub repository not configured.');
  }
  const encodedPath = config.path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${encodedPath}`;
}

async function parseGitHubError(response) {
  let message = `${response.status} ${response.statusText}`;
  try {
    const data = await response.json();
    if (data?.message) {
      message = data.message;
    }
  } catch (_error) {
    // ignore parse failure
  }
  return message;
}

async function fetchRemoteData() {
  if (!config?.token) {
    throw new Error('GitHub token not configured.');
  }
  const url = new URL(githubContentUrl());
  if (config.branch) {
    url.searchParams.set('ref', config.branch);
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: githubHeaders(),
  });

  if (response.status === 404) {
    return { logs: [], sha: null };
  }

  if (!response.ok) {
    throw new Error(await parseGitHubError(response));
  }

  const data = await response.json();
  const decoded = data.content ? base64Decode(data.content) : '';
  let parsed;
  try {
    parsed = decoded ? JSON.parse(decoded) : [];
  } catch (_error) {
    throw new Error('Remote data is not valid JSON.');
  }
  if (!Array.isArray(parsed)) {
    throw new Error('Remote data must be an array.');
  }
  const logs = parsed.map(sanitize).filter(Boolean);
  return { logs, sha: data.sha || null };
}

function commitMessage(action) {
  const timestamp = new Date().toISOString();
  return `zyn-tracker: ${action} (${timestamp})`;
}

async function pushRemoteData(nextCache, action = 'Update logs') {
  if (!config?.token) {
    return;
  }
  const url = githubContentUrl();
  setSyncState({
    enabled: true,
    status: 'syncing',
    message: 'Saving to GitHub…',
  });

  const payload = JSON.stringify(nextCache, null, 2);
  const body = {
    message: commitMessage(action),
    content: base64Encode(payload),
    branch: config.branch || 'main',
  };
  if (remoteSha) {
    body.sha = remoteSha;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: githubHeaders(),
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await parseGitHubError(response);
    throw new Error(error);
  }

  const data = await response.json();
  remoteSha = data?.content?.sha || null;
  setSyncState({
    enabled: true,
    status: 'idle',
    message: `Last synced ${new Date().toLocaleString()}`,
    lastSyncedAt: Date.now(),
  });
}

async function ensureReady() {
  if (initializingPromise) {
    try {
      await initializingPromise;
    } catch (_error) {
      // ignore: sync state already updated
    }
  }
}

async function persist(nextCache, nextIdValue, action) {
  await ensureReady();

  if (config?.token) {
    try {
      await pushRemoteData(nextCache, action);
    } catch (error) {
      setSyncState({
        enabled: true,
        status: 'error',
        message: error.message,
      });
      throw error;
    }
  }

  cache = nextCache;
  nextId = nextIdValue;
  saveLocalData(cache, nextId);
  notify();
}

function calculateNextId(logs) {
  const maxId = logs.reduce((max, log) => Math.max(max, log.id), 0);
  return maxId + 1;
}

async function initializeRemote() {
  if (!config?.token) {
    remoteSha = null;
    initializingPromise = null;
    resetSyncState();
    return;
  }

  const current = (async () => {
    setSyncState({
      enabled: true,
      status: 'syncing',
      message: 'Fetching logs from GitHub…',
    });
    try {
      const { logs, sha } = await fetchRemoteData();
      remoteSha = sha;
      cache = logs;
      nextId = calculateNextId(cache);
      saveLocalData(cache, nextId);
      setSyncState({
        enabled: true,
        status: 'idle',
        message: `Last synced ${new Date().toLocaleString()}`,
        lastSyncedAt: Date.now(),
      });
      notify();
    } catch (error) {
      setSyncState({
        enabled: true,
        status: 'error',
        message: error.message,
      });
      throw error;
    }
  })();

  initializingPromise = current;

  try {
    await current;
  } catch (_error) {
    // propagate silently; sync state already set
  } finally {
    initializingPromise = null;
  }
}

loadLocalData();
if (config?.token) {
  initializeRemote();
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(getLogs());
  return () => listeners.delete(listener);
}

export function subscribeSync(listener) {
  syncListeners.add(listener);
  listener({ ...syncState });
  return () => syncListeners.delete(listener);
}

export function getLogs() {
  return [...cache].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

function ensureIsoTimestamp(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid timestamp. Please pick a valid date and time.');
  }
  return date.toISOString();
}

export async function addLog(timestamp) {
  const iso = ensureIsoTimestamp(timestamp);
  const log = { id: nextId, timestamp: iso };
  const nextCache = [...cache, log];
  const nextIdValue = nextId + 1;
  await persist(nextCache, nextIdValue, `Add log ${log.id}`);
  return log;
}

export async function updateLog(id, timestamp) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    throw new Error('Invalid log id.');
  }
  const index = cache.findIndex((entry) => entry.id === numericId);
  if (index === -1) {
    throw new Error('Log not found.');
  }
  const iso = ensureIsoTimestamp(timestamp);
  const nextCache = [...cache];
  nextCache[index] = { ...nextCache[index], timestamp: iso };
  await persist(nextCache, nextId, `Update log ${numericId}`);
  return nextCache[index];
}

export async function removeLog(id) {
  const numericId = Number(id);
  if (!Number.isInteger(numericId)) {
    throw new Error('Invalid log id.');
  }
  const index = cache.findIndex((entry) => entry.id === numericId);
  if (index === -1) {
    throw new Error('Log not found.');
  }
  const nextCache = cache.filter((entry) => entry.id !== numericId);
  await persist(nextCache, nextId, `Delete log ${numericId}`);
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

export function getConfig() {
  return config ? { ...config, token: config.token } : null;
}

export async function saveConfig(nextConfig) {
  const cleanConfig = {
    owner: (nextConfig.owner || '').trim(),
    repo: (nextConfig.repo || '').trim(),
    branch: nextConfig.branch ? nextConfig.branch.trim() : 'main',
    path: nextConfig.path ? nextConfig.path.trim() : 'data/logs.json',
    token: nextConfig.token || '',
  };

  if (!cleanConfig.owner || !cleanConfig.repo || !cleanConfig.token) {
    throw new Error('Owner, repository, and token are required.');
  }

  storeConfig(cleanConfig);
  remoteSha = null;
  await initializeRemote();
}

export async function clearConfig() {
  storeConfig(null);
  remoteSha = null;
  resetSyncState();
  loadLocalData();
  notify();
}

export async function reloadFromRemote() {
  if (!config?.token) {
    throw new Error('GitHub integration is not configured.');
  }
  await initializeRemote();
}

export function getSyncState() {
  return { ...syncState };
}
