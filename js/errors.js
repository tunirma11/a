export function formatFirebaseError(err) {
  const code = err?.code || "";
  const message = err?.message || String(err || "অজানা ত্রুটি");

  if (message.includes("ভুল সিক্রেট") || message.includes("কনফিগার")) {
    return message;
  }

  switch (code) {
    case "permission-denied":
      return "Firestore অনুমতি নেই — Firebase Console থেকে firestore.rules Publish করুন (conversations + members)";
    case "auth/operation-not-allowed":
      return "Anonymous Authentication Firebase-এ enable করুন";
    case "auth/network-request-failed":
      return "ইন্টারনেট সংযোগ সমস্যা — আবার চেষ্টা করুন";
    case "unavailable":
      return "Firebase সাময়িকভাবে unavailable — কিছুক্ষণ পর চেষ্টা করুন";
    case "failed-precondition":
      return "Firestore index লাগতে পারে — Console-এর লিংক থেকে index তৈরি করুন";
    default:
      break;
  }

  if (/secret|hash/i.test(message)) {
    return "ভুল সিক্রেট — Firebase-এর secretHash যে পাসওয়ার্ড দিয়ে তৈরি, সেটাই ব্যবহার করুন";
  }

  return message;
}
