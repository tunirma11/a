# Private Chat

শুধু **দুজনের** জন্য একটি প্রাইভেট এক-টু-এক PWA চ্যাট অ্যাপ। HTML, CSS, Bootstrap 5 ও vanilla JS। Firebase Firestore রিয়েলটাইম মেসেজিং ও অফলাইন সিঙ্ক।

## ফিচার

- শুধু ১-টু-১ — দুজনের মধ্যে সরাসরি চ্যাট
- সর্বোচ্চ ২ জন রেজিস্টার
- শেয়ার্ড সিক্রেট + ইউজারনেম লগইন/রেজিস্টার
- PWA — হোম স্ক্রিনে ইনস্টল
- অফলাইন মেসেজ সিঙ্ক
- Premium procedural sounds

## Firebase সেটআপ

1. Firestore + Anonymous Auth enable
2. `js/firebase-config.js` — আপনার config
3. `config/app` document:
   ```json
   { "secretHash": "sha256-hash", "maxUsers": 2 }
   ```
4. [`firestore.rules`](firestore.rules) publish করুন
5. Authorized domains: `localhost`, `username.github.io`

## Firestore Collections

```
members/{userId}     — ২ জনের প্রোফাইল (রেজিস্টারে তৈরি)
users/{uid}          — online status
usernames/{id}       — username → uid mapping
conversations/       — একটাই ১-টু-১ চ্যাট
```

> পুরনো `teamUsers` collection ব্যবহার করলে Firestore-এ `members` নামে নতুন collection ব্যবহার করুন।

## ব্যবহার

### প্রথম ব্যক্তি
1. **রেজিস্টার** → সিক্রেট + ইউজারনেম + নাম
2. "সঙ্গীর অপেক্ষায়..." দেখাবে

### দ্বিতীয় ব্যক্তি
1. একই সিক্রেট দিয়ে **রেজিস্টার**
2. স্বয়ংক্রিয়ভাবে চ্যাট শুরু

### পরবর্তীতে
- **প্রবেশ** ট্যাবে লগইন → সরাসরি সঙ্গীর সাথে চ্যাট

## লোকাল টেস্ট

```bash
python3 -m http.server 8080
```

দুই ব্রাউজার/Incognito-তে দুই জন রেজিস্টার করে টেস্ট করুন।
