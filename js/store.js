const DB_NAME = "chat-app-db";
const DB_VERSION = 1;
const OUTBOX_STORE = "outbox";
const PREFS_STORE = "preferences";
const LS_PREFIX = "chatapp_";
const MAX_OUTBOX_IMAGE_URL = 120000;

let dbPromise = null;
let idbDisabled = false;

function lsKey(key) {
  return `${LS_PREFIX}${key}`;
}

function lsGet(key) {
  try {
    const raw = localStorage.getItem(lsKey(key));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function lsSet(key, value) {
  try {
    localStorage.setItem(lsKey(key), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function lsRemove(key) {
  try {
    localStorage.removeItem(lsKey(key));
  } catch {
    /* ignore */
  }
}

function openDB() {
  if (idbDisabled) {
    return Promise.reject(new Error("IndexedDB unavailable"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      idbDisabled = true;
      reject(new Error("IndexedDB unavailable"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        const store = db.createObjectStore(OUTBOX_STORE, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(PREFS_STORE)) {
        db.createObjectStore(PREFS_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      idbDisabled = true;
      dbPromise = null;
      reject(request.error || new Error("IndexedDB open failed"));
    };
  });

  return dbPromise;
}

async function tx(storeName, mode) {
  const db = await openDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

function sanitizeOutboxMessage(message) {
  const next = { ...message };
  if (next.imageUrl && String(next.imageUrl).length > MAX_OUTBOX_IMAGE_URL) {
    delete next.imageUrl;
    next.imageTooLarge = true;
  }
  return next;
}

export async function clearOutbox() {
  try {
    const store = await tx(OUTBOX_STORE, "readwrite");
    await new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    /* ignore */
  }
}

export async function addToOutbox(message) {
  const safe = sanitizeOutboxMessage(message);
  try {
    const store = await tx(OUTBOX_STORE, "readwrite");
    await new Promise((resolve, reject) => {
      const req = store.put(safe);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("outbox save failed:", err);
    idbDisabled = true;
    dbPromise = null;
    throw err;
  }
}

export async function getPendingMessages() {
  try {
    const store = await tx(OUTBOX_STORE, "readonly");
    return await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => {
        const all = req.result || [];
        resolve(
          all
            .filter((m) => m.status === "pending" || m.status === "failed")
            .sort((a, b) => a.createdAt - b.createdAt)
        );
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("outbox read failed, resetting:", err);
    idbDisabled = true;
    dbPromise = null;
    await clearOutbox();
    return [];
  }
}

export async function updateOutboxMessage(id, updates) {
  try {
    const store = await tx(OUTBOX_STORE, "readwrite");
    return await new Promise((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const existing = getReq.result;
        if (!existing) {
          resolve();
          return;
        }
        const putReq = store.put({ ...existing, ...updates });
        putReq.onsuccess = () => resolve();
        putReq.onerror = () => reject(putReq.error);
      };
      getReq.onerror = () => reject(getReq.error);
    });
  } catch (err) {
    console.warn("outbox update failed:", err);
  }
}

export async function removeFromOutbox(id) {
  try {
    const store = await tx(OUTBOX_STORE, "readwrite");
    await new Promise((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("outbox remove failed:", err);
  }
}

export async function getPreference(key) {
  const cached = lsGet(key);
  if (cached !== null) return cached;

  try {
    const store = await tx(PREFS_STORE, "readonly");
    const value = await new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => reject(req.error);
    });
    if (value !== null) lsSet(key, value);
    return value;
  } catch {
    return lsGet(key);
  }
}

export async function setPreference(key, value) {
  lsSet(key, value);
  try {
    const store = await tx(PREFS_STORE, "readwrite");
    await new Promise((resolve, reject) => {
      const req = store.put({ key, value });
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("preference IDB save failed, localStorage kept:", err);
  }
}

export async function getLastChatUser() {
  return getPreference("lastChatUser");
}

export async function setLastChatUser(username) {
  return setPreference("lastChatUser", username);
}

export async function isInstallDismissed() {
  const dismissed = await getPreference("installDismissedAt");
  if (!dismissed) return false;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  return Date.now() - dismissed < sevenDays;
}

export async function dismissInstallPrompt() {
  return setPreference("installDismissedAt", Date.now());
}

const DEVICE_SESSION_KEY = "deviceSession";
const ADMIN_SESSION_KEY = "adminSession";
const ROOM_SESSION_KEY = "roomSession";

export async function getAdminSession() {
  return getPreference(ADMIN_SESSION_KEY);
}

export async function saveAdminSession(session) {
  if (!session) {
    lsRemove(ADMIN_SESSION_KEY);
    try {
      const store = await tx(PREFS_STORE, "readwrite");
      await new Promise((resolve, reject) => {
        const req = store.delete(ADMIN_SESSION_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      /* ignore */
    }
    return;
  }
  return setPreference(ADMIN_SESSION_KEY, session);
}

export async function clearAdminSession() {
  return saveAdminSession(null);
}

export async function getRoomSession() {
  return getPreference(ROOM_SESSION_KEY);
}

export async function saveRoomSession(session) {
  if (!session) {
    lsRemove(ROOM_SESSION_KEY);
    try {
      const store = await tx(PREFS_STORE, "readwrite");
      await new Promise((resolve, reject) => {
        const req = store.delete(ROOM_SESSION_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      /* ignore */
    }
    return;
  }
  return setPreference(ROOM_SESSION_KEY, session);
}

export async function clearRoomSession() {
  return saveRoomSession(null);
}

export async function getDeviceSession() {
  return getPreference(DEVICE_SESSION_KEY);
}

export async function saveDeviceSession(session) {
  if (!session) {
    lsRemove(DEVICE_SESSION_KEY);
    try {
      const store = await tx(PREFS_STORE, "readwrite");
      await new Promise((resolve, reject) => {
        const req = store.delete(DEVICE_SESSION_KEY);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      /* ignore */
    }
    return;
  }
  return setPreference(DEVICE_SESSION_KEY, session);
}

export async function clearDeviceSession() {
  return saveDeviceSession(null);
}

export async function touchDeviceSession() {
  const session = await getDeviceSession();
  if (!session?.username || !session?.roomId) return null;
  const next = { ...session, lastActiveAt: Date.now() };
  await saveDeviceSession(next);
  return next;
}

export function generateLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export function generateSessionId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}
