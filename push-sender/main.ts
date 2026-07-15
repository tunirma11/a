/**
 * Free Web Push sender for GitBridge (Deno Deploy Free — no Firebase Blaze).
 *
 * Secrets (deno deploy --env / dashboard):
 *   VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_SUBJECT   (e.g. mailto:admin@example.com)
 *   FIREBASE_PROJECT_ID  (default: chatapp-1dfee)
 *
 * Deploy:
 *   cd push-sender
 *   deno deploy --project=<your-project> main.ts
 * Then set js/push-config.js PUSH_SENDER_URL to the HTTPS origin.
 */

import webpush from "npm:web-push@3.6.7";
import * as jose from "npm:jose@5.9.6";

const PROJECT_ID = Deno.env.get("FIREBASE_PROJECT_ID") || "chatapp-1dfee";
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:push@gitbridge.local";
const DEFAULT_TEXT = "Today is rainy day";

const JWKS = jose.createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com")
);

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function json(status, body, origin = "*") {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

async function verifyFirebaseToken(idToken) {
  const { payload } = await jose.jwtVerify(idToken, JWKS, {
    issuer: `https://securetoken.google.com/${PROJECT_ID}`,
    audience: PROJECT_ID,
  });
  if (!payload.user_id && !payload.sub) throw new Error("invalid token");
  return String(payload.user_id || payload.sub);
}

async function firestoreGet(path, idToken) {
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/${path}`;
  const headers = {};
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`firestore ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.json();
}

function fieldString(doc, key) {
  return doc?.fields?.[key]?.stringValue ?? null;
}

function fieldBool(doc, key) {
  return doc?.fields?.[key]?.booleanValue === true;
}

function fieldMap(doc, key) {
  return doc?.fields?.[key]?.mapValue?.fields || null;
}

function parsePushSubs(mapFields) {
  if (!mapFields) return [];
  const out = [];
  for (const entry of Object.values(mapFields)) {
    const f = entry?.mapValue?.fields;
    if (!f) continue;
    const endpoint = f.endpoint?.stringValue;
    const p256dh = f.keys?.mapValue?.fields?.p256dh?.stringValue;
    const auth = f.keys?.mapValue?.fields?.auth?.stringValue;
    if (endpoint && p256dh && auth) {
      out.push({ endpoint, keys: { p256dh, auth } });
    }
  }
  return out;
}

async function handleNotify(req, origin) {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return json(500, { error: "vapid_not_configured" }, origin);
  }

  const auth = req.headers.get("Authorization") || "";
  const idToken = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!idToken) return json(401, { error: "missing_token" }, origin);

  let body;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" }, origin);
  }

  const roomId = String(body?.roomId || "").trim();
  if (!roomId) return json(400, { error: "missing_roomId" }, origin);

  let uid;
  try {
    uid = await verifyFirebaseToken(idToken);
  } catch {
    return json(401, { error: "invalid_token" }, origin);
  }

  const userDoc = await firestoreGet(`users/${uid}`, idToken);
  if (!userDoc) return json(403, { error: "no_user" }, origin);

  const username = fieldString(userDoc, "username");
  const userRoomId = fieldString(userDoc, "roomId");
  if (!username || username === "m1") {
    return json(403, { error: "m1_cannot_trigger" }, origin);
  }
  if (userRoomId !== roomId) {
    return json(403, { error: "room_mismatch" }, origin);
  }

  const roomDoc = await firestoreGet(`rooms/${encodeURIComponent(roomId)}`);
  if (!roomDoc) return json(404, { error: "room_not_found" }, origin);
  if (!fieldBool(roomDoc, "pushNotifyM1")) {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  const text =
    String(fieldString(roomDoc, "pushNotifyText") || "").trim() || DEFAULT_TEXT;

  const memberDoc = await firestoreGet(
    `rooms/${encodeURIComponent(roomId)}/members/m1`
  );
  const subs = parsePushSubs(fieldMap(memberDoc, "pushSubs"));
  if (!subs.length) {
    return json(200, { sent: 0, reason: "no_subscriptions" }, origin);
  }

  // Message text only — no app URL / click_action / chat content.
  const cleanText = text.replace(/https?:\/\/\S+/gi, "").trim() || DEFAULT_TEXT;
  const payload = JSON.stringify({ title: cleanText });

  let sent = 0;
  const stale = [];
  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload, {
          TTL: 60 * 60,
          urgency: "high",
          headers: {},
        });
        sent += 1;
      } catch (err) {
        const status = err?.statusCode || err?.status;
        if (status === 404 || status === 410) stale.push(sub.endpoint);
      }
    })
  );

  return json(200, { sent, stale }, origin);
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin") || "*";
  const url = new URL(req.url);

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(origin) });
  }

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
    return json(200, { ok: true, service: "gitbridge-push-sender" }, origin);
  }

  if (req.method === "POST" && url.pathname === "/notify") {
    try {
      return await handleNotify(req, origin);
    } catch (err) {
      console.error(err);
      return json(500, { error: "server_error" }, origin);
    }
  }

  return json(404, { error: "not_found" }, origin);
});
