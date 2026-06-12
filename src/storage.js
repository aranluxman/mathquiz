import { ACHIEVEMENTS } from "./games.js";
import { syncSession } from "./supabase.js";

const DB_NAME = "mathflow-arcade";
const DB_VERSION = 1;
const SESSION_STORE = "sessions";
const META_STORE = "meta";
const DEVICE_KEY = "mathflow-device-id";

let dbPromise;

function fallbackList(key) {
  try {
    return JSON.parse(localStorage.getItem(key) || "[]");
  } catch {
    return [];
  }
}

function fallbackSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function openDatabase() {
  if (!("indexedDB" in window)) return Promise.resolve(null);
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SESSION_STORE)) {
        const store = db.createObjectStore(SESSION_STORE, { keyPath: "id" });
        store.createIndex("created_at", "created_at");
        store.createIndex("game_id", "game_id");
      }
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE, { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
  return dbPromise;
}

function tx(storeName, mode, callback) {
  return openDatabase().then(
    (db) =>
      new Promise((resolve, reject) => {
        if (!db) {
          resolve(null);
          return;
        }
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const result = callback(store);
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
      })
  );
}

export function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export async function saveSession(session) {
  const record = {
    ...session,
    id: session.id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`),
    device_id: getDeviceId(),
    created_at: session.created_at || new Date().toISOString(),
    synced: false
  };

  const saved = await tx(SESSION_STORE, "readwrite", (store) => store.put(record)).catch(() => null);
  if (!saved) {
    const sessions = fallbackList("mathflow-sessions");
    sessions.unshift(record);
    fallbackSet("mathflow-sessions", sessions.slice(0, 300));
  }

  const remote = await syncSession(record);
  if (remote.ok) {
    record.synced = true;
    await tx(SESSION_STORE, "readwrite", (store) => store.put(record)).catch(() => null);
  }

  return { record, remote };
}

export async function loadSessions() {
  const db = await openDatabase();
  if (!db) return fallbackList("mathflow-sessions");
  return new Promise((resolve) => {
    const transaction = db.transaction(SESSION_STORE, "readonly");
    const request = transaction.objectStore(SESSION_STORE).getAll();
    request.onsuccess = () => resolve((request.result || []).sort((a, b) => b.created_at.localeCompare(a.created_at)));
    request.onerror = () => resolve(fallbackList("mathflow-sessions"));
  });
}

export async function getMeta(key, fallback = null) {
  const record = await tx(META_STORE, "readonly", (store) => store.get(key)).catch(() => null);
  if (record && "value" in record) return record.value;
  try {
    return JSON.parse(localStorage.getItem(`mathflow-meta-${key}`)) ?? fallback;
  } catch {
    return fallback;
  }
}

export async function setMeta(key, value) {
  const record = { key, value };
  const saved = await tx(META_STORE, "readwrite", (store) => store.put(record)).catch(() => null);
  if (!saved) localStorage.setItem(`mathflow-meta-${key}`, JSON.stringify(value));
}

export async function loadSettings() {
  return {
    theme: await getMeta("theme", "dark"),
    sound: await getMeta("sound", true),
    operations: await getMeta("operations", ["add", "sub", "mul", "div"])
  };
}

export async function summarizeProgress() {
  const sessions = await loadSessions();
  const totalSolved = sessions.reduce((sum, session) => sum + Number(session.solved || 0), 0);
  const totalScore = sessions.reduce((sum, session) => sum + Number(session.score || 0), 0);
  const bestScore = sessions.reduce((best, session) => Math.max(best, Number(session.score || 0)), 0);
  const bestStreak = sessions.reduce((best, session) => Math.max(best, Number(session.max_streak || 0)), 0);
  const gamesPlayed = new Set(sessions.map((session) => session.game_id)).size;
  const level = Math.max(1, Math.floor(totalSolved / 50) + 1);
  const xp = totalSolved % 50;
  return { sessions, totalSolved, totalScore, bestScore, bestStreak, gamesPlayed, level, xp };
}

export async function evaluateAchievements(session) {
  const unlocked = await getMeta("achievements", []);
  const progress = await summarizeProgress();
  const playedGames = new Set(progress.sessions.map((item) => item.game_id));
  const earned = [];
  const checks = {
    "first-run": progress.sessions.length >= 1,
    "ten-solved": Number(session.solved || 0) >= 10,
    "streak-10": Number(session.max_streak || 0) >= 10,
    "perfect-round": Number(session.attempts || 0) > 0 && Number(session.accuracy_pct || 0) === 100,
    "hundred-total": progress.totalSolved >= 100,
    "daily-player": session.mode === "daily",
    "multi-arcade": playedGames.size >= 3
  };

  for (const achievement of ACHIEVEMENTS) {
    if (!unlocked.includes(achievement.id) && checks[achievement.id]) {
      unlocked.push(achievement.id);
      earned.push(achievement);
    }
  }

  await setMeta("achievements", unlocked);
  return earned;
}
