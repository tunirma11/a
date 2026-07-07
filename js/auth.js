import {
  signInAnonymously,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc,
  getDoc,
  setDoc,
  runTransaction,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { auth, db } from "./firebase.js";
import { createTeamUser } from "./users.js";
import { normalizeUserId, validateUserId } from "./constants.js";
import { sha256Hex } from "./crypto-utils.js";

let currentUserDoc = null;

export async function hashSecret(secret) {
  return sha256Hex(secret);
}

async function validateSecret(secret) {
  const configRef = doc(db, "config", "app");
  const snap = await getDoc(configRef);
  if (!snap.exists()) {
    throw new Error("অ্যাপ কনফিগার করা হয়নি। Firebase Console-এ config/app সেট করুন।");
  }
  const storedHash = snap.data().secretHash;
  const inputHash = await hashSecret(secret);
  if (inputHash !== storedHash) {
    throw new Error("ভুল সিক্রেট। আবার চেষ্টা করুন।");
  }
}

async function claimUsername(uid, username) {
  const teamSnap = await getDoc(doc(db, "members", username));
  if (!teamSnap.exists()) {
    throw new Error("এই ইউজারনেম নেই — রেজিস্টার করুন।");
  }
  const userMeta = teamSnap.data();

  const usernameRef = doc(db, "usernames", username);
  const userRef = doc(db, "users", uid);

  await runTransaction(db, async (transaction) => {
    const usernameSnap = await transaction.get(usernameRef);
    const userSnap = await transaction.get(userRef);

    if (usernameSnap.exists()) {
      const existingUid = usernameSnap.data().uid;
      if (existingUid !== uid) {
        const existingUser = await transaction.get(doc(db, "users", existingUid));
        if (existingUser.exists() && existingUser.data().isOnline) {
          throw new Error(`${userMeta.name} ইতিমধ্যে অনলাইনে আছে।`);
        }
        transaction.set(usernameRef, { uid });
      }
    } else {
      transaction.set(usernameRef, { uid });
    }

    transaction.set(
      userRef,
      {
        username,
        displayName: userMeta.name,
        isOnline: true,
        lastSeen: serverTimestamp(),
      },
      { merge: true }
    );
  });

  const userSnap = await getDoc(userRef);
  currentUserDoc = { uid, ...userSnap.data() };
  return currentUserDoc;
}

export async function login(secret, rawUsername) {
  const username = normalizeUserId(rawUsername);
  const idError = validateUserId(username);
  if (idError) throw new Error(idError);

  const cred = await signInAnonymously(auth);
  try {
    await validateSecret(secret);
    const user = await claimUsername(cred.user.uid, username);
    return user;
  } catch (err) {
    await signOut(auth);
    throw err;
  }
}

export async function register(secret, rawId, rawName) {
  const username = normalizeUserId(rawId);
  const idError = validateUserId(username);
  if (idError) throw new Error(idError);

  const cred = await signInAnonymously(auth);
  try {
    await validateSecret(secret);
    await createTeamUser(rawId, rawName);
    const user = await claimUsername(cred.user.uid, username);
    return user;
  } catch (err) {
    await signOut(auth);
    throw err;
  }
}

export async function logout() {
  if (auth.currentUser) {
    const userRef = doc(db, "users", auth.currentUser.uid);
    await setDoc(
      userRef,
      { isOnline: false, lastSeen: serverTimestamp() },
      { merge: true }
    ).catch(() => {});
  }
  currentUserDoc = null;
  await signOut(auth);
}

export function onAuthChange(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (!user) {
      currentUserDoc = null;
      callback(null);
      return;
    }
    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      currentUserDoc = { uid: user.uid, ...snap.data() };
      await setDoc(
        userRef,
        { isOnline: true, lastSeen: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
      callback(currentUserDoc);
    } else {
      currentUserDoc = null;
      callback(null);
    }
  });
}

export function getCurrentUser() {
  return currentUserDoc;
}

export async function refreshCurrentUser() {
  if (!auth.currentUser) return null;
  const snap = await getDoc(doc(db, "users", auth.currentUser.uid));
  if (snap.exists()) {
    currentUserDoc = { uid: auth.currentUser.uid, ...snap.data() };
  }
  return currentUserDoc;
}

export async function sendHeartbeat() {
  if (!auth.currentUser) return;
  await setDoc(
    doc(db, "users", auth.currentUser.uid),
    { isOnline: true, lastSeen: serverTimestamp() },
    { merge: true }
  ).catch(() => {});
}
