(function(){
  const DB_NAME = 'soundboard-db-v1';
  const STORE = 'sounds';

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('by_name', 'name', { unique: false });
          store.createIndex('by_createdAt', 'createdAt', { unique: false });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function withStore(mode, callback) {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      let result;
      try {
        result = callback(store);
      } catch (err) {
        reject(err);
      }
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  async function addSound(name, blob, mimeType) {
    const createdAt = Date.now();
    return withStore('readwrite', (store) => store.add({ name, blob, mimeType, createdAt }));
  }

  async function getAllSounds() {
    return withStore('readonly', (store) => {
      return new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    });
  }

  async function getSound(id) {
    return withStore('readonly', (store) => store.get(id));
  }

  async function deleteSound(id) {
    return withStore('readwrite', (store) => store.delete(id));
  }

  async function renameSound(id, newName) {
    return withStore('readwrite', (store) => {
      return new Promise((resolve, reject) => {
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const item = getReq.result;
          if (!item) { resolve(false); return; }
          item.name = newName;
          const putReq = store.put(item);
          putReq.onsuccess = () => resolve(true);
          putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
      });
    });
  }

  window.SoundboardDB = {
    addSound,
    getAllSounds,
    getSound,
    deleteSound,
    renameSound,
  };
})();