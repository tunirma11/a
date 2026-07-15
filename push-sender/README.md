# GitBridge Push Sender — Deno Deploy সম্পূর্ণ সেটআপ (ফ্রি / $0)

এই গাইড **Windows** ধরে লেখা। লক্ষ্য: `push-sender` ডিপ্লয় করে `js/push-config.js`-এ URL বসানো — তারপর m2 মেসেজে m1 ডিভাইসে নোটিফ যাবে।

---

## ধাপ ০ — যা যা লাগবে

- Git / প্রজেক্ট ফোল্ডার আছে (`sad/push-sender`)
- Firebase প্রজেক্ট আইডি: `chatapp-1dfee` (ইতিমধ্যে ব্যবহার হচ্ছে)
- ইমেইল (Deno অ্যাকাউন্টের জন্য)
- **কার্ড লাগবে না** (Deno Deploy Free)

---

## ধাপ ১ — Deno ইনস্টল (কম্পিউটারে)

### PowerShell (Admin না হলেও চলে)

```powershell
irm https://deno.land/install.ps1 | iex
```

ইনস্টল শেষে **নতুন টার্মিনাল** খুলুন, তারপর:

```powershell
deno --version
```

ভার্সন দেখালে ঠিক আছে। না দেখালে PATH রিফ্রেশ করতে PC রিস্টার্ট বা টার্মিনাল বন্ধ-খুলুন।

---

## ধাপ ২ — কোন বাটন চাপবেন? (নতুন Deno UI)

পুরনো সাইটে «Create Project» ছিল। এখন নতুন ড্যাশবোর্ড:

👉 যান: **[https://console.deno.com](https://console.deno.com)**  
(পুরনো `dash.deno.com` নয় — সেটা Classic, বন্ধ হয়ে যাচ্ছে)

| বাটন | কী করবেন |
|------|----------|
| **+ New App** | ✅ এটাই লাগবে (আগের «project» এর বদলে এখন **App**) |
| New Playground | ❌ শেখার জন্য — আমাদের `push-sender` এর জন্য নয় |
| New Sandbox | ❌ এক্সপেরিমেন্ট — স্কিপ |

আগে যদি organization না থাকে → আগে **Create organization** করুন, তারপর **+ New App**।

### আপনার জন্য সবচেয়ে সহজ পথ: CLI (সুপারিশ)

`push-sender` পুরো GitHub রিপোর সাবফোল্ডার। নতুন Deno UI-তে GitHub অ্যাপ দিয়ে **সাবফোল্ডার মনো-রিপো এখনো সাপোর্টেড নয়** — তাই ড্যাশবোর্ডে GitHub কানেক্ট করার ঝামেলা এড়িয়ে **CLI** ব্যবহার করুন। ড্যাশবোর্ডে অ্যাপ আলাদা করে না বানালেও চলবে; `deno deploy` নিজেই App বানিয়ে দেবে।

---

## ধাপ ৩ — CLI দিয়ে অ্যাপ তৈরি + ডিপ্লয়

PowerShell:

```powershell
cd "C:\Users\uss\Desktop\New folder (2)\my-project\sad\push-sender"

deno --version
deno deploy
```

প্রথমবার ব্রাউজার খুলে লগইন চাইবে → Deno অ্যাকাউন্ট অনুমতি দিন।

ওizard/প্রম্পটে সাধারণত:
1. **Organization** বেছে নিন (বা নতুন বানান)
2. **App name** দিন: `gitbridge-push` (ইচ্ছা মতো)
3. Source: **local** (লোকাল ফোল্ডার আপলোড)
4. Entrypoint / dynamic: `main.ts`
5. Framework: **No preset** / raw Deno API সার্ভার

সফল হলে টার্মিনালে URL পাবেন, যেমন:

`https://gitbridge-push-<org>.deno.dev`  
বা ড্যাশবোর্ডে যে Production URL দেখায়

> শুধু ডিপ্লয় (আগে থেকে app থাকলে): একই ফোল্ডার থেকে আবার `deno deploy`

---

## ধাপ ৪ — Secrets (Env vars) সেট করুন

### উপায় A — CLI (সহজ)

`push-sender` ফোল্ডারে `.env` বানান (`.env.example` কপি):

```powershell
copy .env.example .env
notepad .env
```

`.env` এ `VAPID_SUBJECT` আপনার ইমেইলে বদলান। তারপর:

```powershell
deno deploy env load .env
```

অথবা একটা একটা করে:

```powershell
deno deploy env add VAPID_PUBLIC_KEY "BEdsY9WoY3hrZFe1qJiMCqIROdsYm2D9hMK6-jXWW04fRSl5qKPsCNGXrDG5vyTsSaMevhvkkCiLIKp4B7eJlR4"
deno deploy env add VAPID_PRIVATE_KEY "8gRvQLl6EBkt1e38_f_ClnWF8ooVLrE4OMX8eJaH4Rg" --secret
deno deploy env add VAPID_SUBJECT "mailto:you@example.com"
deno deploy env add FIREBASE_PROJECT_ID "chatapp-1dfee"
```

Secret বদলালে পরের রিকোয়েস্টেই কাজ করে; সমস্যা হলে আবার `deno deploy` চালান।

### উপায় B — ড্যাশবোর্ড

[console.deno.com](https://console.deno.com) → আপনার **App** → **Environment Variables** → Add:

| Name | Value | Secret? |
|------|--------|---------|
| `VAPID_PUBLIC_KEY` | `BEdsY9WoY3hrZFe1qJiMCqIROdsYm2D9hMK6-jXWW04fRSl5qKPsCNGXrDG5vyTsSaMevhvkkCiLIKp4B7eJlR4` | না |
| `VAPID_PRIVATE_KEY` | `8gRvQLl6EBkt1e38_f_ClnWF8ooVLrE4OMX8eJaH4Rg` | ✅ হ্যাঁ |
| `VAPID_SUBJECT` | `mailto:আপনার@email.com` | না |
| `FIREBASE_PROJECT_ID` | `chatapp-1dfee` | না |

Context: **Production** (এবং চাইলে Development)।

**গুরুত্বপূর্ণ:**
- Public key অবশ্যই [`js/push-config.js`](../js/push-config.js) এর সাথে **একই**
- Private key ক্লায়েন্ট/GitHub-এ পাবলিক পোস্ট করবেন না


---

## ধাপ ৫ — হেলথ চেক

ব্রাউজারে খুলুন:

`https://YOUR-PROJECT.deno.dev/health`

অথবা:

`https://YOUR-PROJECT.deno.dev/`

এমন JSON দেখা উচিত:

```json
{"ok":true,"service":"gitbridge-push-sender"}
```

`500` / error হলে Secrets ভুল বা ডিপ্লয় হয়নি — ধাপ ৩–৪ আবার চেক করুন।

---

## ধাপ ৬ — অ্যাপে URL বসান

ফাইল: [`js/push-config.js`](../js/push-config.js)

```js
export const PUSH_SENDER_URL = "https://gitbridge-push.deno.dev";
```

- শেষে **`/` রাখবেন না**
- আপনার আসল Deno URL দিন

সাইট GitHub Pages / Firebase Hosting যেখানেই হোক — এই ফাইল সহ **আবার পাবলিশ / পুশ** করুন যাতে প্রোডাকশনে নতুন কনফিগ যায়।

---

## ধাপ ৭ — অ্যাডমিনে নোটিফ চালু

1. অ্যাপে অ্যাডমিন লগইন
2. রুম খুলুন
3. **m1 ডিভাইস নোটিফিকেশন** চেক করুন
4. মেসেজ ফিল্ড (ডিফল্ট: `Today is rainy day`) — চাইলে বদলান
5. **নোটিফ সেটিংস সেভ**

---

## ধাপ ৮ — m1 ডিভাইসে পারমিশন

1. **m1** অ্যাকাউন্টে লগইন (Android Chrome অথবা Home Screen PWA)
2. ব্রাউজার **Allow notifications** দিন
3. (iPhone হলে) আগে Home Screen-এ অ্যাপ যোগ + iOS 16.4+)

এতে m1 এর সাবস্ক্রিপশন Firestore `rooms/{roomId}/members/m1.pushSubs`-এ সেভ হয়।

---

## ধাপ ৯ — টেস্ট

1. m1 অ্যাপ **বন্ধ** করুন / ব্যাকগ্রাউন্ডে রাখুন
2. অন্য ডিভাইস/ব্রাউজারে **m2** লগইন → যেকোনো মেসেজ পাঠান
3. m1 ফোনে notification drawer-এ **শুধু** অ্যাডমিনের টেক্সট দেখা উচিত (লিংক/চ্যাট টেক্সট নয়)

কাজ না করলে নিচের চেকলিস্ট দেখুন।

---

## ট্রাবলশুটিং

| সমস্যা | কী করবেন |
|--------|----------|
| `/health` খোলে না | প্রজেক্ট নাম/URL ভুল; আবার `deno deploy` |
| m2 পাঠালেও নোটিফ নেই | `PUSH_SENDER_URL` খালি/ভুল কিনা; অ্যাপ রিডিপ্লয় হয়েছে কিনা |
| | অ্যাডমিন টগল **চালু** ও সেভ হয়েছে কিনা |
| | m1 **Allow** দিয়েছে কিনা |
| Deno লগে 401 | m2 সত্যিই লগইন (Firebase Auth) কিনা |
| Deno লগে 403 `m1_cannot_trigger` | m1 দিয়ে ট্রিগার হচ্ছে — m2 দিয়ে পাঠান |
| Deno লগে `vapid_not_configured` | Secrets সেট হয়নি / ডিপ্লয়ের আগে সেট করেননি → Secrets + আবার ডিপ্লয় |
| iPhone-এ কিছু হয় না | Safari ট্যাব নয় — **Add to Home Screen** PWA লাগবে |

Deno Dashboard → প্রজেক্ট → **Logs** এ `/notify` রিকোয়েস্ট দেখা যায়।

---

## লোকাল টেস্ট (ঐচ্ছিক)

Secrets লোকাল `.env` ফাইলে (কমিট করবেন না — `.gitignore`-এ আছে):

```powershell
cd push-sender
copy .env.example .env
# প্রয়োজনে .env এডিট
deno task start
```

লোকাল URL সাধারণত `http://localhost:8000` — প্রোডাকশন ক্লায়েন্ট HTTPS পুশের জন্য Deno URLই ব্যবহার করুন।

---

## আচরণ (মনে রাখুন)

- `POST /notify` — শুধু **m2** (অথবা non-m1) Firebase ID token দিয়ে
- নোটিফ টেক্সট আসে Firestore `rooms/{id}.pushNotifyText` থেকে
- Firebase **Spark** থাকে; **Blaze লাগে না**
