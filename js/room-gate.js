import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db } from "./firebase.js";
import { sha256Hex } from "./crypto-utils.js";
import { QUICK_LOGIN_IDLE_MS, ONLINE_THRESHOLD_MS } from "./constants.js";
import { getRoom } from "./rooms.js";
import { fetchMembersOnce, getMembers } from "./users.js";
import { getRoomSession, saveRoomSession, getDeviceSession } from "./store.js";
import { ensureAnonymousAuth, isUserRecentlyActive } from "./auth.js";

export async function verifyRoomPassword(roomId, password) {
  const room = await getRoom(roomId);
  if (!room) throw new Error("রুম পাওয়া যায়নি");
  if (room.status === "disabled") throw new Error("এই রুম নিষ্ক্রিয় করা হয়েছে");

  const storedHash = String(room.passwordHash || "").trim();
  const inputHash = await sha256Hex(String(password).trim());
  if (!storedHash || inputHash !== storedHash) {
    throw new Error("ভুল রুম পাসওয়ার্ড");
  }

  await saveRoomSession({
    roomId,
    passwordVerifiedAt: Date.now(),
  });
  return room;
}

export async function isRoomPasswordVerified(roomId) {
  const session = await getRoomSession();
  if (!session?.roomId || session.roomId !== roomId) return false;
  if (!session.passwordVerifiedAt) return false;
  return Date.now() - session.passwordVerifiedAt < 24 * 60 * 60 * 1000;
}

async function getOnlineUsernames(roomId) {
  const snap = await getDocs(query(collection(db, "users"), where("roomId", "==", roomId)));
  const online = new Set();
  snap.docs.forEach((d) => {
    const data = d.data();
    if (data.isOnline && isUserRecentlyActive(data.lastSeen?.toMillis?.() ?? data.lastSeen, ONLINE_THRESHOLD_MS)) {
      online.add(data.username);
    }
  });
  return online;
}

export async function claimMemberSlot(roomId) {
  await ensureAnonymousAuth();

  const room = await getRoom(roomId);
  if (!room) throw new Error("রুম পাওয়া যায়নি");
  if (room.status === "disabled") throw new Error("এই রুম নিষ্ক্রিয় করা হয়েছে");

  await fetchMembersOnce(roomId);
  const members = getMembers();
  if (members.length === 0) {
    throw new Error("অ্যাডমিন এখনো এই রুমে সদস্য যোগ করেননি");
  }

  const deviceSession = await getDeviceSession();
  if (
    deviceSession?.roomId === roomId &&
    deviceSession?.username &&
    members.some((m) => m.id === deviceSession.username) &&
    Date.now() - (deviceSession.lastActiveAt || 0) < QUICK_LOGIN_IDLE_MS
  ) {
    return deviceSession.username;
  }

  const onlineUsernames = await getOnlineUsernames(roomId);

  if (
    deviceSession?.roomId === roomId &&
    deviceSession?.username &&
    members.some((m) => m.id === deviceSession.username) &&
    !onlineUsernames.has(deviceSession.username)
  ) {
    return deviceSession.username;
  }

  const available = members.find((m) => !onlineUsernames.has(m.id));
  if (!available) {
    throw new Error("রুমে ইতিমধ্যে ২ জন সক্রিয় — পরে আবার চেষ্টা করুন");
  }

  return available.id;
}
