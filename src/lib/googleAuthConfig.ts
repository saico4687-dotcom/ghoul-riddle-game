/**
 * Google OAuth Web Client ID.
 *
 * هذا الـ ID عام (ليس سراً) ويمكن وضعه في الكود.
 * احصل عليه من Google Cloud Console → APIs & Services → Credentials →
 *   OAuth 2.0 Client IDs → اختر نوع "Web application" → Client ID
 *
 * مهم:
 *  - استخدم نفس Web Client ID في Supabase Authentication → Providers → Google
 *  - أنشئ Android OAuth Client منفصل بنفس Package name (com.rebh.app)
 *    و SHA-1 الخاص بمفتاح توقيع Google Play
 */
export const GOOGLE_WEB_CLIENT_ID =
  "65418662258-4e4rnnp3pnsop9d4flqrbsjj5t3mudm8.apps.googleusercontent.com";

export const isGoogleConfigured = () =>
  GOOGLE_WEB_CLIENT_ID.startsWith("REPLACE_") === false &&
  GOOGLE_WEB_CLIENT_ID.endsWith(".apps.googleusercontent.com");
