(function(){
  const grid = document.getElementById('grid');
  const fileInput = document.getElementById('file-input');
  const dropZone = document.getElementById('drop-zone');
  const stopAllButton = document.getElementById('stop-all');
  const volumeSlider = document.getElementById('volume');
  const cardTemplate = document.getElementById('card-template');

  /** @type {Map<number, Blob>} */
  const idToBlob = new Map();
  /** @type {Map<number, string>} */
  const idToName = new Map();
  /** @type {Set<HTMLAudioElement>} */
  const activeAudios = new Set();
  let globalVolume = 1;

  function sanitizeName(name) {
    const trimmed = (name || '').trim();
    if (trimmed.length === 0) return 'Untitled';
    return trimmed.slice(0, 120);
  }

  function extFromMime(type) {
    if (!type) return '';
    const parts = type.split('/');
    return parts[1] ? '.' + parts[1] : '';
  }

  function showEmptyHintIfNeeded() {
    if (grid.children.length === 0) {
      const hint = document.createElement('div');
      hint.className = 'empty-hint';
      hint.textContent = 'No sounds yet. Use Upload or drag & drop to add audio files.';
      grid.appendChild(hint);
    } else {
      const hint = grid.querySelector('.empty-hint');
      if (hint) hint.remove();
    }
  }

  function createCard(id, name) {
    const node = cardTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = String(id);
    const playBtn = node.querySelector('.play');
    const nameEl = node.querySelector('.name');
    const deleteBtn = node.querySelector('.delete');

    nameEl.textContent = name;

    playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      playSound(id);
    });

    node.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && e.target === node) {
        e.preventDefault();
        playSound(id);
      }
    });

    nameEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameEl.blur();
      }
    });

    nameEl.addEventListener('blur', async () => {
      const newName = sanitizeName(nameEl.textContent);
      nameEl.textContent = newName;
      if (newName !== idToName.get(id)) {
        await window.SoundboardDB.renameSound(id, newName);
        idToName.set(id, newName);
      }
    });

    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const confirmDelete = confirm('Delete this sound?');
      if (!confirmDelete) return;
      await window.SoundboardDB.deleteSound(id);
      idToBlob.delete(id);
      idToName.delete(id);
      node.remove();
      showEmptyHintIfNeeded();
    });

    return node;
  }

  function addCardToGrid(node) {
    const emptyHint = grid.querySelector('.empty-hint');
    if (emptyHint) emptyHint.remove();
    grid.appendChild(node);
  }

  function playSound(id) {
    const blob = idToBlob.get(id);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.volume = globalVolume;
    audio.play().catch(() => {/* ignore */});

    activeAudios.add(audio);
    audio.addEventListener('ended', () => {
      activeAudios.delete(audio);
      URL.revokeObjectURL(url);
    });
    audio.addEventListener('pause', () => {
      // Paused due to Stop All
      URL.revokeObjectURL(url);
    }, { once: true });
  }

  function stopAll() {
    for (const audio of activeAudios) {
      try {
        audio.pause();
        audio.currentTime = 0;
      } catch {}
    }
    activeAudios.clear();
  }

  async function handleFiles(files) {
    const valid = Array.from(files).filter(f => f.type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac|flac|webm|oga)$/i.test(f.name));
    if (valid.length === 0) return;

    for (const file of valid) {
      const nameBase = file.name.replace(/\.[^.]+$/, '');
      const name = sanitizeName(nameBase);
      const blob = file.slice(0, file.size, file.type || 'audio/mpeg');
      const id = await window.SoundboardDB.addSound(name, blob, blob.type);
      idToBlob.set(id, blob);
      idToName.set(id, name);
      const card = createCard(id, name);
      addCardToGrid(card);
    }
  }

  function setupDnD() {
    let dragDepth = 0;

    const show = () => dropZone.classList.add('active');
    const hide = () => dropZone.classList.remove('active');

    ['dragenter', 'dragover'].forEach(evt => {
      window.addEventListener(evt, (e) => {
        e.preventDefault();
        dragDepth += 1;
        show();
      });
    });

    ['dragleave', 'drop'].forEach(evt => {
      window.addEventListener(evt, (e) => {
        e.preventDefault();
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) hide();
      });
    });

    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      const files = e.dataTransfer?.files;
      if (files && files.length) {
        handleFiles(files);
      }
      dropZone.classList.remove('active');
      dragDepth = 0;
    });
  }

  function setupEvents() {
    fileInput.addEventListener('change', (e) => {
      const input = e.target;
      if (input && input.files && input.files.length) {
        handleFiles(input.files);
        fileInput.value = '';
      }
    });

    stopAllButton.addEventListener('click', stopAll);

    volumeSlider.addEventListener('input', () => {
      globalVolume = Number(volumeSlider.value);
      for (const audio of activeAudios) {
        audio.volume = globalVolume;
      }
    });
  }

  async function init() {
    setupDnD();
    setupEvents();

    const sounds = await window.SoundboardDB.getAllSounds();
    sounds.sort((a, b) => a.createdAt - b.createdAt);
    for (const s of sounds) {
      idToBlob.set(s.id, s.blob);
      idToName.set(s.id, s.name);
      const card = createCard(s.id, s.name);
      addCardToGrid(card);
    }
    showEmptyHintIfNeeded();
  }

  document.addEventListener('DOMContentLoaded', init);
})();