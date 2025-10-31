import { addLog, subscribe } from './storage.js';

const statusEl = document.querySelector('#status');
const todayList = document.querySelector('#today-list');
const todayEmpty = document.querySelector('#today-empty');
const logNowButton = document.querySelector('#log-now');
const form = document.querySelector('#custom-log');
const timestampField = document.querySelector('#timestamp');

const formatter = new Intl.DateTimeFormat([], {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function isToday(timestamp) {
  const now = new Date();
  const time = new Date(timestamp);
  return (
    now.getFullYear() === time.getFullYear() &&
    now.getMonth() === time.getMonth() &&
    now.getDate() === time.getDate()
  );
}

function renderToday(logs) {
  if (!todayList || !todayEmpty) return;
  todayList.innerHTML = '';

  const todayLogs = logs.filter((log) => isToday(log.timestamp));
  if (!todayLogs.length) {
    todayEmpty.hidden = false;
    todayList.hidden = true;
    return;
  }

  todayEmpty.hidden = true;
  todayList.hidden = false;

  todayLogs
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .forEach((log) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${formatter.format(
        new Date(log.timestamp)
      )}</span><span class="badge">Today</span>`;
      todayList.appendChild(li);
    });
}

subscribe(renderToday);

function setStatus(message) {
  if (statusEl) {
    statusEl.textContent = message;
  }
}

logNowButton?.addEventListener('click', () => {
  if (!logNowButton) return;

  logNowButton.disabled = true;
  setStatus('Saving…');

  try {
    addLog(new Date().toISOString());
    setStatus('Logged successfully!');
  } catch (error) {
    setStatus(error.message);
  } finally {
    logNowButton.disabled = false;
  }
});

form?.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!form || !timestampField) return;

  const raw = timestampField.value;
  if (!raw) {
    setStatus('Pick a time first.');
    return;
  }

  const submitButton = form.querySelector('button[type="submit"]');
  if (submitButton) {
    submitButton.disabled = true;
  }
  setStatus('Saving…');

  try {
    addLog(new Date(raw).toISOString());
    setStatus('Logged successfully!');
    form.reset();
  } catch (error) {
    setStatus(error.message);
  } finally {
    if (submitButton) {
      submitButton.disabled = false;
    }
  }
});
