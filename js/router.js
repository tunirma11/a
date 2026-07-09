import { ROOM_ID_PATTERN } from "./constants.js";

const RESERVED_SEGMENTS = new Set(["admin", "index.html", "css", "js", "icons"]);

let routeCallback = null;

export function getAppBasePath() {
  const el = document.querySelector('script[src*="js/app.js"]');
  if (!el) return "/";
  const jsPath = new URL(el.getAttribute("src"), window.location.href).pathname;
  const base = jsPath.replace(/js\/app\.js$/, "");
  return base.endsWith("/") ? base : `${base}/`;
}

function getPathSegment() {
  const base = getAppBasePath();
  const rest = window.location.pathname.slice(base.length).replace(/^\/+|\/+$/g, "");
  if (!rest) return null;
  return rest.split("/")[0].toLowerCase();
}

function migrateLegacyHashIfNeeded() {
  const hash = window.location.hash || "";
  if (!hash) return;

  const roomMatch = hash.match(/^#\/?room\/([a-z0-9_-]+)/i);
  if (roomMatch) {
    const id = roomMatch[1].toLowerCase();
    if (ROOM_ID_PATTERN.test(id)) {
      history.replaceState(null, "", getAppBasePath());
      return;
    }
  }

  if (/^#\/?admin\/?$/i.test(hash)) {
    history.replaceState(null, "", `${getAppBasePath()}admin`);
  }
}

export function restoreSpaRedirect() {
  const redirect = sessionStorage.getItem("spa-path");
  if (!redirect) return;
  sessionStorage.removeItem("spa-path");
  const target = redirect.split("?")[0];
  if (target && target !== window.location.pathname) {
    history.replaceState(null, "", redirect);
  }
}

function emitRouteChange() {
  routeCallback?.(parseRoute());
}

function navigateTo(path) {
  const base = getAppBasePath();
  const url = path.startsWith("/") ? path : `${base}${path}`;
  if (`${window.location.pathname}${window.location.search}` === url) {
    emitRouteChange();
    return;
  }
  history.pushState(null, "", url);
  emitRouteChange();
}

export function parseRoute() {
  migrateLegacyHashIfNeeded();

  const segment = getPathSegment();
  if (segment === "admin") {
    return { view: "admin" };
  }

  // পুরনো রুম-লিংক (/roomId) — রুটে রিডাইরেক্ট, রুম কোড প্রিফিল
  if (segment && !RESERVED_SEGMENTS.has(segment) && ROOM_ID_PATTERN.test(segment)) {
    history.replaceState(null, "", getAppBasePath());
    return { view: "home", prefillRoomId: segment };
  }

  return { view: "home" };
}

/** @deprecated use parseRoute — kept for compatibility */
export function getRoomIdFromHash() {
  const route = parseRoute();
  return route.prefillRoomId || null;
}

export function navigateToAdmin() {
  navigateTo("admin");
}

export function navigateToHome() {
  navigateTo(getAppBasePath());
}

export function buildAppLink() {
  return `${window.location.origin}${getAppBasePath()}`;
}

/** @deprecated use buildAppLink */
export function buildShareLink() {
  return buildAppLink();
}

export function onRouteChange(callback) {
  routeCallback = callback;
  const handler = () => callback(parseRoute());
  window.addEventListener("popstate", handler);
  restoreSpaRedirect();
  handler();
}
