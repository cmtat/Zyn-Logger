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

async function fetchLogs() {
  const res = await fetch('/api/logs');
  if (!res.ok) {
    throw new Error('Failed to load logs');
  }
  return res.json();
}

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
      li.innerHTML = `<span>${formatter.format(new Date(log.timestamp))}</span><span class="badge">Today</span>`;
      todayList.appendChild(li);
    });
}

async function refresh() {
  try {
    const logs = await fetchLogs();
    renderToday(logs);
  } catch (error) {
    statusEl.textContent = error.message;
  }
}

async function createLog(timestamp) {
  const res = await fetch('/api/logs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp }),
  });

  if (!res.ok) {
    const { error } = await res.json();
    throw new Error(error || 'Unable to create log');
  }

  return res.json();
}

logNowButton?.addEventListener('click', async () => {
  logNowButton.disabled = true;
  statusEl.textContent = 'Saving…';
  try {
    await createLog(new Date().toISOString());
    statusEl.textContent = 'Logged successfully!';
    refresh();
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    logNowButton.disabled = false;
  }
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const raw = timestampField.value;
  if (!raw) {
    statusEl.textContent = 'Pick a time first.';
    return;
  }

  statusEl.textContent = 'Saving…';
  form.querySelector('button[type="submit"]').disabled = true;
  try {
    const iso = new Date(raw).toISOString();
    await createLog(iso);
    statusEl.textContent = 'Logged successfully!';
    form.reset();
    refresh();
  } catch (error) {
    statusEl.textContent = error.message;
  } finally {
    form.querySelector('button[type="submit"]').disabled = false;
  }
});

refresh();
