import { doc, getDoc, updateDoc, deleteField } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { db, auth } from "./firebase.js";
import { isPrimaryMember } from "./users.js";
import { VAPID_PUBLIC_KEY, PUSH_SENDER_URL, DEFAULT_PUSH_NOTIFY_TEXT } from "./push-config.js";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function subKey(subscription) {
  try {
    const endpoint = subscription?.endpoint || "";
    let hash = 0;
    for (let i = 0; i < endpoint.length; i++) {
      hash = (hash * 31 + endpoint.charCodeAt(i)) >>> 0;
    }
    return `s${hash.toString(36)}`;
  } catch {
    return `s${Date.now().toString(36)}`;
  }
}

export async function initM1Push(roomId, username) {
  if (!isPrimaryMember(username) || !roomId) return;
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  if (!VAPID_PUBLIC_KEY) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    }

    const json = subscription.toJSON();
    if (!json?.endpoint || !json?.keys?.p256dh || !json?.keys?.auth) return;

    const key = subKey(json);
    await updateDoc(doc(db, "rooms", roomId, "members", "m1"), {
      [`pushSubs.${key}`]: {
        endpoint: json.endpoint,
        keys: {
          p256dh: json.keys.p256dh,
          auth: json.keys.auth,
        },
        updatedAt: Date.now(),
      },
    });
  } catch (err) {
    console.warn("initM1Push:", err);
  }
}

/**
 * Best-effort notify for m1. Call after a non-m1 member successfully sends.
 * Notification body comes from room.pushNotifyText on the server (Deno), not chat text.
 */
export async function notifyM1Device(roomId) {
  if (!roomId || !PUSH_SENDER_URL) return;
  const me = auth.currentUser;
  if (!me) return;

  try {
    const roomSnap = await getDoc(doc(db, "rooms", roomId));
    if (!roomSnap.exists()) return;
    const room = roomSnap.data();
    if (room.pushNotifyM1 !== true) return;

    const idToken = await me.getIdToken();
    await fetch(`${PUSH_SENDER_URL.replace(/\/$/, "")}/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ roomId }),
    });
  } catch (err) {
    console.warn("notifyM1Device:", err);
  }
}

export async function clearM1PushSubscription(roomId, username) {
  if (!isPrimaryMember(username) || !roomId) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) return;
    const json = subscription.toJSON();
    const key = subKey(json);
    await updateDoc(doc(db, "rooms", roomId, "members", "m1"), {
      [`pushSubs.${key}`]: deleteField(),
    });
    await subscription.unsubscribe().catch(() => {});
  } catch {
    /* ignore */
  }
}

export { DEFAULT_PUSH_NOTIFY_TEXT };
