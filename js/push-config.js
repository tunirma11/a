/** Web Push public config — private VAPID key lives only on the free Deno sender. */
export const VAPID_PUBLIC_KEY =
  "BEdsY9WoY3hrZFe1qJiMCqIROdsYm2D9hMK6-jXWW04fRSl5qKPsCNGXrDG5vyTsSaMevhvkkCiLIKp4B7eJlR4";

/** After `deno deploy` of push-sender/, set the HTTPS URL here (no trailing slash). */
export const PUSH_SENDER_URL = "https://gitbridge-push.appbaz1.deno.net";

export const DEFAULT_PUSH_NOTIFY_TEXT = "Today is rainy day";
