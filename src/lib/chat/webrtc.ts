// إعدادات خوادم STUN/TURN ومنطق مشترك لمكالمات WebRTC.
// المكالمات نفسها بث مباشر (RTCPeerConnection) بدون أي تسجيل أو تخزين —
// السيرفر (Supabase) يُستخدم فقط كقناة إشارة (Signaling) لتبادل SDP/ICE.

export type CallKind = "audio" | "video";
export type CallStatus = "ringing" | "accepted" | "declined" | "ended" | "missed";
export type SignalType = "offer" | "answer" | "ice-candidate" | "hangup";

// مدة الرنين قبل اعتبار المكالمة "لم يُرد عليها" (Missed) — نفس المعيار الشائع في WhatsApp (~45 ثانية).
export const RING_TIMEOUT_MS = 45_000;

/**
 * قائمة خوادم ICE. تُقرأ TURN اختياريًا من متغيرات البيئة (VITE_TURN_URL / VITE_TURN_USERNAME /
 * VITE_TURN_CREDENTIAL) لأن STUN وحده لا يكفي لعبور NAT في جزء كبير من شبكات الموبايل/الشركات.
 * بدون TURN مُعرَّف، تعمل المكالمات على معظم الشبكات المنزلية/الويفاي لكنها قد تفشل خلف NAT صارم —
 * وهذا سيُستكمل في مرحلة لاحقة بربط مزوّد TURN حقيقي (مثل Twilio أو coturn ذاتي الاستضافة).
 */
export function getIceServers(): RTCIceServer[] {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];

  const turnUrl = import.meta.env.VITE_TURN_URL as string | undefined;
  const turnUsername = import.meta.env.VITE_TURN_USERNAME as string | undefined;
  const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL as string | undefined;

  if (turnUrl && turnUsername && turnCredential) {
    servers.push({ urls: turnUrl, username: turnUsername, credential: turnCredential });
  }

  return servers;
}

export function getRtcConfig(): RTCConfiguration {
  return {
    iceServers: getIceServers(),
    iceCandidatePoolSize: 4,
  };
}

export function mediaConstraintsFor(kind: CallKind): MediaStreamConstraints {
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video:
      kind === "video"
        ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }
        : false,
  };
}

/** يوقف كل مسارات الوسائط (مايك/كاميرا) — لازم يُستدعى دايمًا عند إنهاء المكالمة. */
export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}
