import {
  clearConfig,
  getConfig,
  getSyncState,
  reloadFromRemote,
  saveConfig,
  subscribeSync,
} from './storage.js';

const openButtons = document.querySelectorAll('[data-action="open-settings"]');
const dialog = document.querySelector('#settings-dialog');
const form = document.querySelector('#settings-form');
const ownerField = document.querySelector('#settings-owner');
const repoField = document.querySelector('#settings-repo');
const branchField = document.querySelector('#settings-branch');
const pathField = document.querySelector('#settings-path');
const tokenField = document.querySelector('#settings-token');
const statusEl = document.querySelector('#sync-status');
const messageEl = document.querySelector('#sync-status-message');
const saveButton = form?.querySelector('[data-action="save-settings"]');
const cancelButtons = dialog?.querySelectorAll('[data-action="close-settings"]') || [];
const clearButton = dialog?.querySelector('[data-action="clear-config"]');
const reloadButton = dialog?.querySelector('[data-action="reload-config"]');

function setBusy(isBusy) {
  if (!form) return;
  Array.from(form.elements).forEach((element) => {
    if (element instanceof HTMLButtonElement || element instanceof HTMLInputElement) {
      if (element.dataset.lockable === 'false') {
        return;
      }
      element.disabled = isBusy;
    }
  });
}

function populateForm() {
  if (!form) return;
  const config = getConfig();
  ownerField.value = config?.owner || '';
  repoField.value = config?.repo || '';
  branchField.value = config?.branch || 'main';
  pathField.value = config?.path || 'data/logs.json';
  tokenField.value = config?.token || '';

  if (clearButton) {
    clearButton.disabled = !config;
  }
  if (reloadButton) {
    reloadButton.disabled = !config;
  }
}

function updateStatus(state) {
  if (!statusEl || !messageEl) return;
  let text = 'GitHub sync disabled. Using local storage only.';
  if (state.enabled) {
    if (state.status === 'syncing') {
      text = state.message || 'Syncing with GitHub…';
    } else if (state.status === 'error') {
      text = state.message
        ? `Sync error: ${state.message}`
        : 'Sync error. Check your token or repository.';
    } else {
      text = state.message || 'GitHub sync ready.';
    }
  }
  statusEl.dataset.state = state.status || 'idle';
  messageEl.textContent = text;
}

openButtons.forEach((button) => {
  button.addEventListener('click', () => {
    if (!dialog) return;
    populateForm();
    dialog.showModal();
  });
});

cancelButtons.forEach((button) => {
  button.addEventListener('click', () => {
    dialog?.close();
  });
});

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!form) return;

  setBusy(true);
  try {
    await saveConfig({
      owner: ownerField.value,
      repo: repoField.value,
      branch: branchField.value,
      path: pathField.value,
      token: tokenField.value,
    });
    dialog?.close();
  } catch (error) {
    if (messageEl) {
      messageEl.textContent = error.message;
    }
  } finally {
    setBusy(false);
  }
});

clearButton?.addEventListener('click', async () => {
  if (!dialog) return;
  if (!confirm('Disable GitHub sync and switch to local storage?')) return;

  setBusy(true);
  try {
    await clearConfig();
    populateForm();
  } catch (error) {
    if (messageEl) {
      messageEl.textContent = error.message;
    }
  } finally {
    setBusy(false);
  }
});

reloadButton?.addEventListener('click', async () => {
  setBusy(true);
  try {
    await reloadFromRemote();
  } catch (error) {
    if (messageEl) {
      messageEl.textContent = error.message;
    }
  } finally {
    setBusy(false);
  }
});

subscribeSync(updateStatus);
updateStatus(getSyncState());
