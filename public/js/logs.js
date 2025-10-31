const tableBody = document.querySelector('#logs-table');
const emptyState = document.querySelector('#logs-empty');
const editDialog = document.querySelector('#edit-dialog');
const editForm = document.querySelector('#edit-form');
const editIdField = document.querySelector('#edit-id');
const editTimestampField = document.querySelector('#edit-timestamp');

const formatter = new Intl.DateTimeFormat([], {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function toLocalInputValue(timestamp) {
  const date = new Date(timestamp);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

async function fetchLogs() {
  const response = await fetch('/api/logs');
  if (!response.ok) {
    throw new Error('Failed to load logs');
  }
  return response.json();
}

async function updateLog(id, timestamp) {
  const response = await fetch(`/api/logs/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ timestamp }),
  });

  if (!response.ok) {
    const { error } = await response.json();
    throw new Error(error || 'Unable to update log');
  }
}

async function deleteLog(id) {
  const response = await fetch(`/api/logs/${id}`, { method: 'DELETE' });
  if (!response.ok) {
    const { error } = await response.json();
    throw new Error(error || 'Unable to delete log');
  }
}

function renderLogs(logs) {
  tableBody.innerHTML = '';
  if (!logs.length) {
    emptyState.hidden = false;
    emptyState.textContent = 'No logs recorded yet.';
    return;
  }
  emptyState.hidden = true;

  logs.forEach((log) => {
    const tr = document.createElement('tr');
    tr.dataset.timestamp = log.timestamp;
    tr.innerHTML = `
      <td>${log.id}</td>
      <td>
        <button class="link-button" data-action="edit" data-id="${log.id}">
          ${formatter.format(new Date(log.timestamp))}
        </button>
      </td>
      <td>
        <div class="actions">
          <button class="button" data-action="edit" data-id="${log.id}">Edit</button>
          <button class="button" data-action="delete" data-id="${log.id}">Delete</button>
        </div>
      </td>
    `;
    tableBody.appendChild(tr);
  });
}

async function refresh() {
  try {
    const logs = await fetchLogs();
    renderLogs(logs);
  } catch (error) {
    emptyState.hidden = false;
    emptyState.textContent = error.message;
  }
}

tableBody.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const row = button.closest('tr');
  const id = Number(button.dataset.id);
  const action = button.dataset.action;

  if (action === 'edit') {
    openEditor(id, row.dataset.timestamp);
    return;
  }

  if (action === 'delete') {
    if (!confirm('Delete this log?')) {
      return;
    }
    button.disabled = true;
    try {
      await deleteLog(id);
      await refresh();
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  }
});

function openEditor(id, timestamp) {
  editIdField.value = id;
  editTimestampField.value = toLocalInputValue(timestamp);
  editDialog.showModal();
}

editForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = Number(editIdField.value);
  const timestampValue = editTimestampField.value;
  if (!timestampValue) return;

  const iso = new Date(timestampValue).toISOString();
  try {
    await updateLog(id, iso);
    editDialog.close();
    await refresh();
  } catch (error) {
    alert(error.message);
  }
});

editDialog.addEventListener('close', () => {
  editForm.reset();
});

editForm
  .querySelector('[data-action="cancel"]')
  .addEventListener('click', () => {
    editDialog.close();
  });

refresh();
