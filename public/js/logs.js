import {
  buildCsv,
  getLogs,
  removeLog,
  subscribe,
  updateLog,
} from './storage.js';

const tableBody = document.querySelector('#logs-table');
const emptyState = document.querySelector('#logs-empty');
const editDialog = document.querySelector('#edit-dialog');
const editForm = document.querySelector('#edit-form');
const editIdField = document.querySelector('#edit-id');
const editTimestampField = document.querySelector('#edit-timestamp');
const cancelButton = editForm?.querySelector('[data-action="cancel"]');
const exportButton = document.querySelector('#export-logs');

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

function renderLogs(logs) {
  if (!tableBody || !emptyState) return;

  tableBody.innerHTML = '';
  if (!logs.length) {
    emptyState.hidden = false;
    emptyState.textContent = 'No logs recorded yet.';
  } else {
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

  if (exportButton) {
    exportButton.disabled = !logs.length;
  }
}

subscribe(renderLogs);

tableBody?.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;

  const row = button.closest('tr');
  if (!row) return;

  const id = Number(button.dataset.id);
  const action = button.dataset.action;

  if (action === 'edit') {
    openEditor(id, row.dataset.timestamp);
    return;
  }

  if (action === 'delete') {
    if (!confirm('Delete this log?')) return;
    button.disabled = true;
    try {
      await removeLog(id);
    } catch (error) {
      alert(error.message);
    } finally {
      button.disabled = false;
    }
  }
});

function openEditor(id, timestamp) {
  if (!editDialog || !editIdField || !editTimestampField) return;
  editIdField.value = String(id);
  editTimestampField.value = toLocalInputValue(timestamp);
  editDialog.showModal();
}

editForm?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!editIdField || !editTimestampField || !editDialog) return;

  const id = Number(editIdField.value);
  const raw = editTimestampField.value;
  if (!raw) return;

  try {
    await updateLog(id, new Date(raw).toISOString());
    editDialog.close();
  } catch (error) {
    alert(error.message);
  }
});

cancelButton?.addEventListener('click', () => {
  editDialog?.close();
});

editDialog?.addEventListener('close', () => {
  editForm?.reset();
});

exportButton?.addEventListener('click', () => {
  const logs = getLogs();
  if (!logs.length) {
    alert('No logs to export yet.');
    return;
  }
  const csv = buildCsv();
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'zyn-logs.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
