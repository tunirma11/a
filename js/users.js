import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  query,
  orderBy,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import {
  MAX_USERS,
  validateUserId,
  validateDisplayName,
  normalizeUserId,
} from "./constants.js";

const MEMBERS_COL = "members";

let membersCache = [];

function sortMembers(members) {
  return [...members].sort((a, b) => a.name.localeCompare(b.name));
}

export function getMembers() {
  return sortMembers(membersCache);
}

export function getMemberById(id) {
  return membersCache.find((u) => u.id === id) || null;
}

export function getOtherMember(currentUsername) {
  return membersCache.find((u) => u.id !== currentUsername) || null;
}

export function getMemberCount() {
  return membersCache.length;
}

export function canRegister() {
  return membersCache.length < MAX_USERS;
}

export function getUserIndex(id) {
  const sorted = sortMembers(membersCache);
  return sorted.findIndex((u) => u.id === id);
}

export async function fetchMembersOnce() {
  try {
    const snap = await getDocs(query(collection(db, MEMBERS_COL), orderBy("name")));
    membersCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (err) {
    if (err?.code === "failed-precondition") {
      const snap = await getDocs(collection(db, MEMBERS_COL));
      membersCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    } else {
      throw err;
    }
  }
  return sortMembers(membersCache);
}

export function listenToMembers(callback) {
  return onSnapshot(
    query(collection(db, MEMBERS_COL), orderBy("name")),
    (snap) => {
      membersCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      callback(sortMembers(membersCache));
    },
    (err) => {
      console.error("members listener error:", err);
      callback(sortMembers(membersCache), err);
    }
  );
}

export async function createMember(rawId, rawName) {
  const id = normalizeUserId(rawId);
  const idError = validateUserId(id);
  if (idError) throw new Error(idError);

  const name = String(rawName || "").trim();
  const nameError = validateDisplayName(name);
  if (nameError) throw new Error(nameError);

  if (membersCache.length >= MAX_USERS) {
    throw new Error("এই চ্যাটে ইতিমধ্যে ২ জন আছে — নতুন রেজিস্টার করা যাবে না");
  }

  const existing = await getDoc(doc(db, MEMBERS_COL, id));
  if (existing.exists()) {
    throw new Error("এই ইউজারনেম ইতিমধ্যে আছে — প্রবেশ করুন");
  }

  await setDoc(doc(db, MEMBERS_COL, id), {
    id,
    name,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  membersCache = [...membersCache, { id, name }];
}

// পুরনো কোডের সাথে সামঞ্জস্য
export const getTeamUsers = getMembers;
export const getTeamUserById = getMemberById;
export const fetchTeamUsersOnce = fetchMembersOnce;
export const listenToTeamUsers = listenToMembers;
export const createTeamUser = createMember;
