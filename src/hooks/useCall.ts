import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  getRtcConfig,
  mediaConstraintsFor,
  stopStream,
  RING_TIMEOUT_MS,
  type CallKind,
} from "@/lib/chat/webrtc";
import { sendCallPush } from "@/lib/chat/push";
import { fetchPublicProfile } from "@/lib/chat/queries";
import type { Database, Json } from "@/integrations/supabase/types";

type CallRow = Database["public"]["Tables"]["calls"]["Row"];
type CallSignalRow = Database["public"]["Tables"]["call_signals"]["Row"];

export type CallPhase = "idle" | "outgoing" | "incoming" | "connected" | "ended";

interface UseCallResult {
  phase: CallPhase;
  call: CallRow | null;
  peerId: string | null;
  kind: CallKind | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  muted: boolean;
  cameraOff: boolean;
  // true مؤقتًا لما الاتصال يتقطع (شبكة ضعيفة/NAT) ولسه بنحاول نسترجعه
  // قبل ما نعتبر المكالمة منتهية فعليًا — راجع الشرح جوّه onconnectionstatechange.
  reconnecting: boolean;
  error: string | null;
  startCall: (calleeId: string, kind: CallKind) => Promise<void>;
  acceptCall: () => Promise<void>;
  declineCall: () => Promise<void>;
  hangUp: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  // تبديل كاميرا أمامية/خلفية أثناء مكالمة فيديو (موبايل بشكل أساسي)
  switchCamera: () => Promise<void>;
}

/**
 * إدارة دورة حياة مكالمة صوتية/فيديو واحدة عبر WebRTC.
 * السيرفر (Supabase) يُستخدم فقط لتبادل SDP/ICE عبر جدول call_signals + Realtime،
 * ولمعرفة حالة المكالمة (ringing/accepted/declined/ended/missed) عبر جدول calls.
 * لا يوجد أي تسجيل أو تخزين للصوت/الفيديو نفسه في أي مرحلة.
 */
export function useCall(): UseCallResult {
  const { user } = useAuth();

  const [phase, setPhase] = useState<CallPhase>("idle");
  const [call, setCall] = useState<CallRow | null>(null);
  const [peerId, setPeerId] = useState<string | null>(null);
  const [kind, setKind] = useState<CallKind | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const callRef = useRef<CallRow | null>(null);
  const signalChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const callRowChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const ringTimeoutRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const facingModeRef = useRef<"user" | "environment">("user");
  const processedSignalIds = useRef<Set<number>>(new Set());
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const remoteDescSet = useRef(false);

  useEffect(() => {
    callRef.current = call;
  }, [call]);

  const clearRingTimeout = useCallback(() => {
    if (ringTimeoutRef.current) {
      window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = null;
    }
  }, []);

  const clearReconnectTimeout = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      window.clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  /** يُصفّر كل شيء ويرجع للحالة idle — يُستدعى عند إنهاء/رفض/فشل المكالمة من أي طرف. */
  const cleanup = useCallback(() => {
    clearRingTimeout();
    clearReconnectTimeout();
    pcRef.current?.close();
    pcRef.current = null;
    stopStream(localStreamRef.current);
    localStreamRef.current = null;
    if (signalChannelRef.current) {
      supabase.removeChannel(signalChannelRef.current);
      signalChannelRef.current = null;
    }
    if (callRowChannelRef.current) {
      supabase.removeChannel(callRowChannelRef.current);
      callRowChannelRef.current = null;
    }
    processedSignalIds.current.clear();
    pendingIce.current = [];
    remoteDescSet.current = false;
    facingModeRef.current = "user";
    setLocalStream(null);
    setRemoteStream(null);
    setCall(null);
    setPeerId(null);
    setKind(null);
    setMuted(false);
    setCameraOff(false);
    setReconnecting(false);
    setPhase("idle");
  }, [clearRingTimeout, clearReconnectTimeout]);

  const sendSignal = useCallback(
    async (
      callId: string,
      signalType: CallSignalRow["signal_type"],
      payload: RTCSessionDescriptionInit | RTCIceCandidateInit | Record<string, never>
    ) => {
      if (!user) return;
      await supabase.from("call_signals").insert({
        call_id: callId,
        sender_id: user.id,
        signal_type: signalType,
        payload: JSON.parse(JSON.stringify(payload)) as Json,
      });
    },
    [user]
  );

  const createPeerConnection = useCallback(
    (callId: string) => {
      const pc = new RTCPeerConnection(getRtcConfig());

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          sendSignal(callId, "ice-candidate", event.candidate.toJSON()).catch(() => {});
        }
      };

      pc.ontrack = (event) => {
        setRemoteStream(event.streams[0] ?? null);
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          clearRingTimeout();
          clearReconnectTimeout();
          setReconnecting(false);
          setPhase("connected");
        } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
          // انقطاع مؤقت شائع مع تنقّل الشبكة (واي فاي↔بيانات) أو NAT صارم.
          // منقفلش المكالمة فورًا: نجرّب Ice Restart (لو أنا اللي بديت
          // المكالمة) وننتظر مهلة سماح قبل ما نعتبرها فشلت فعليًا —
          // بالظبط زي سلوك واتساب ("جاري إعادة الاتصال...").
          setReconnecting(true);
          if (pc.connectionState === "failed" && pc.restartIce) {
            try {
              pc.restartIce();
            } catch {
              /* بعض المتصفحات القديمة مش بتدعم restartIce — نتجاهل ونسيب مهلة السماح تتكفل */
            }
          }
          if (!reconnectTimeoutRef.current) {
            reconnectTimeoutRef.current = window.setTimeout(async () => {
              reconnectTimeoutRef.current = null;
              const stillBad =
                pcRef.current?.connectionState === "disconnected" || pcRef.current?.connectionState === "failed";
              if (!stillBad) return; // استرجع الاتصال لوحده خلال المهلة
              setError("تعذّر الاتصال — تأكد من اتصالك بالإنترنت");
              const row = callRef.current;
              if (row) {
                try {
                  await supabase.rpc("end_call", { _call_id: row.id, _final_status: "ended" });
                } catch {
                  /* لو فشل التحديث، الطرف التاني هيقفل من عنده برضه لما الاتصال يتقطع فعليًا */
                }
              }
              cleanup();
              setPhase("ended");
            }, 10_000);
          }
        }
      };

      pcRef.current = pc;
      return pc;
    },
    [sendSignal, clearRingTimeout, clearReconnectTimeout, cleanup]
  );

  /** يشترك في قناة call_signals الخاصة بمكالمة معيّنة ويعالج offer/answer/ice/hangup الواردة. */
  const subscribeToSignals = useCallback(
    (callId: string, isCaller: boolean) => {
      const ch = supabase
        .channel(`call-signals:${callId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "call_signals", filter: `call_id=eq.${callId}` },
          async (payload) => {
            const row = payload.new as CallSignalRow;
            if (processedSignalIds.current.has(row.id)) return;
            processedSignalIds.current.add(row.id);
            if (row.sender_id === user?.id) return; // تجاهل إشاراتي أنا نفسي

            const pc = pcRef.current;
            if (!pc) return;

            if (row.signal_type === "answer" && isCaller) {
              await pc.setRemoteDescription(new RTCSessionDescription(row.payload as unknown as RTCSessionDescriptionInit));
              remoteDescSet.current = true;
              for (const c of pendingIce.current) await pc.addIceCandidate(new RTCIceCandidate(c));
              pendingIce.current = [];
            } else if (row.signal_type === "ice-candidate") {
              const candidate = row.payload as unknown as RTCIceCandidateInit;
              if (remoteDescSet.current) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
              } else {
                pendingIce.current.push(candidate);
              }
            } else if (row.signal_type === "hangup") {
              cleanup();
              setPhase("ended");
            }
          }
        )
        .subscribe();

      signalChannelRef.current = ch;
    },
    [user, cleanup]
  );

  /** يشترك في تحديثات صف calls نفسه (قبول/رفض/إنهاء من الطرف الآخر). */
  const watchCallRow = useCallback(
    (callId: string) => {
      const ch = supabase
        .channel(`call-row:${callId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "calls", filter: `id=eq.${callId}` },
          (payload) => {
            if (callRowChannelRef.current !== ch) return; // القناة اتشالت بالفعل بمعرفة cleanup محلي
            const row = payload.new as CallRow;
            setCall(row);
            if (row.status === "declined" || row.status === "ended" || row.status === "missed") {
              cleanup();
              setPhase("ended");
            }
          }
        )
        .subscribe();
      callRowChannelRef.current = ch;
      return ch;
    },
    [cleanup]
  );

  // ===== الاستماع للمكالمات الواردة (Global) =====
  useEffect(() => {
    if (!user) return;

    const ch = supabase
      .channel(`incoming-calls:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "calls", filter: `callee_id=eq.${user.id}` },
        (payload) => {
          const row = payload.new as CallRow;
          if (row.status !== "ringing") return;
          if (callRef.current) return; // مشغول بمكالمة أخرى بالفعل

          setCall(row);
          setPeerId(row.caller_id);
          setKind(row.kind as CallKind);
          setPhase("incoming");
          subscribeToSignals(row.id, false);
          watchCallRow(row.id);

          // لو محدش رد خلال مهلة الرنين، السيرفر/الطرف التاني هيحدّث الحالة لـ missed
          // وده هيوصلنا عبر watchCallRow تلقائيًا فنرجع idle.
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ===== فحص عند بدء التشغيل: هل فيه مكالمة "ringing" موجّهة لي بالفعل؟ =====
  // لو التطبيق كان مقفول ووصل Push لمكالمة واردة، أو المستخدم عمل
  // Refresh أثناء الرنين، صف الإشارة الأول (INSERT) يكون فات قبل ما
  // الاشتراك فوق ده يبدأ يسمع — فبنعمل فحص لمرة واحدة عند التحميل.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("calls")
        .select("*")
        .eq("callee_id", user.id)
        .eq("status", "ringing")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data || callRef.current) return;
      const row = data as CallRow;
      // تجاهل مكالمة قديمة جدًا تعدّت مهلة الرنين — هتتحوّل "missed" تلقائيًا
      // لما المتصل يوصل لمهلته من عنده، مفيش داعي نعرضها كواردة دلوقتي.
      if (Date.now() - new Date(row.created_at).getTime() > RING_TIMEOUT_MS) return;

      setCall(row);
      setPeerId(row.caller_id);
      setKind(row.kind as CallKind);
      setPhase("incoming");
      subscribeToSignals(row.id, false);
      watchCallRow(row.id);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // تنظيف عند فك تركيب المكوّن (تنقل بين الصفحات مثلاً أثناء مكالمة)
  useEffect(() => {
    return () => {
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCall = useCallback(
    async (calleeId: string, callKind: CallKind) => {
      if (!user || callRef.current) return;
      setError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia(mediaConstraintsFor(callKind));
        localStreamRef.current = stream;
        setLocalStream(stream);

        const { data, error: rpcError } = await supabase.rpc("start_call", {
          _callee_id: calleeId,
          _kind: callKind,
        });
        if (rpcError || !data) throw rpcError ?? new Error("تعذّر بدء المكالمة");

        const row = data as CallRow;
        setCall(row);
        setPeerId(calleeId);
        setKind(callKind);
        setPhase("outgoing");

        // Push حقيقي للمستقبِل يوصل حتى لو التطبيق مقفول تمامًا — مش
        // حرج لو فشل (مثلاً لسه ملوش جهاز مسجّل)، فمنستناهوش (fire-and-forget)
        // ومنسيبوش أي فشل فيه يوقف بدء المكالمة نفسها.
        fetchPublicProfile(user.id)
          .then((me) => sendCallPush(calleeId, me?.username ?? "صديق", callKind))
          .catch(() => {});

        const pc = createPeerConnection(row.id);
        stream.getTracks().forEach((t) => pc.addTrack(t, stream));
        subscribeToSignals(row.id, true);
        watchCallRow(row.id);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignal(row.id, "offer", offer);

        ringTimeoutRef.current = window.setTimeout(async () => {
          if (callRef.current?.status === "ringing") {
            await supabase.rpc("end_call", { _call_id: row.id, _final_status: "ended" });
            cleanup();
            setPhase("ended");
          }
        }, RING_TIMEOUT_MS);
      } catch (e) {
        stopStream(localStreamRef.current);
        localStreamRef.current = null;
        setLocalStream(null);
        setError(e instanceof Error ? e.message : "تعذّر الوصول للمايك/الكاميرا");
        setPhase("idle");
      }
    },
    [user, createPeerConnection, subscribeToSignals, watchCallRow, sendSignal, cleanup]
  );

  const acceptCall = useCallback(async () => {
    const row = callRef.current;
    if (!row || !kind) return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraintsFor(kind));
      localStreamRef.current = stream;
      setLocalStream(stream);

      await supabase.rpc("respond_to_call", { _call_id: row.id, _new_status: "accepted" });

      const pc = createPeerConnection(row.id);
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));

      // نجيب أي إشارات وصلت قبل ما نقبل (العرض offer + أي ice candidates سابقة)
      const { data: existing } = await supabase
        .from("call_signals")
        .select("*")
        .eq("call_id", row.id)
        .order("created_at", { ascending: true });

      for (const sig of existing ?? []) {
        processedSignalIds.current.add(sig.id);
        if (sig.sender_id === callRef.current?.caller_id && sig.signal_type === "offer") {
          await pc.setRemoteDescription(new RTCSessionDescription(sig.payload as unknown as RTCSessionDescriptionInit));
          remoteDescSet.current = true;
        } else if (sig.signal_type === "ice-candidate" && sig.sender_id !== user?.id) {
          if (remoteDescSet.current) {
            await pc.addIceCandidate(new RTCIceCandidate(sig.payload as unknown as RTCIceCandidateInit));
          } else {
            pendingIce.current.push(sig.payload as unknown as RTCIceCandidateInit);
          }
        }
      }
      for (const c of pendingIce.current) await pc.addIceCandidate(new RTCIceCandidate(c));
      pendingIce.current = [];

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignal(row.id, "answer", answer);
    } catch (e) {
      stopStream(localStreamRef.current);
      localStreamRef.current = null;
      setLocalStream(null);
      setError(e instanceof Error ? e.message : "تعذّر الوصول للمايك/الكاميرا");
      await supabase.rpc("end_call", { _call_id: row.id, _final_status: "ended" });
      cleanup();
    }
  }, [kind, user, createPeerConnection, sendSignal, cleanup]);

  const declineCall = useCallback(async () => {
    const row = callRef.current;
    if (!row) return;
    await supabase.rpc("respond_to_call", { _call_id: row.id, _new_status: "declined" });
    cleanup();
  }, [cleanup]);

  const hangUp = useCallback(async () => {
    const row = callRef.current;
    if (!row) {
      cleanup();
      return;
    }
    try {
      await sendSignal(row.id, "hangup", {});
    } catch {
      /* لو فشل الإرسال، إنهاء الحالة في قاعدة البيانات كافٍ */
    }
    await supabase.rpc("end_call", { _call_id: row.id, _final_status: "ended" });
    cleanup();
  }, [sendSignal, cleanup]);

  const toggleMute = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextMuted = !muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !nextMuted));
    setMuted(nextMuted);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const nextOff = !cameraOff;
    stream.getVideoTracks().forEach((t) => (t.enabled = !nextOff));
    setCameraOff(nextOff);
  }, [cameraOff]);

  /**
   * تبديل الكاميرا الأمامية/الخلفية أثناء مكالمة فيديو شغالة، بدون ما
   * نوقف المكالمة أو نعيد التفاوض (Renegotiation) — بناخد Track فيديو
   * جديد من الكاميرا التانية ونستبدله في الـ RTCRtpSender مباشرة عبر
   * replaceTrack، وهي نفس الطريقة اللي واتساب/ماسنجر بيستخدموها.
   */
  const switchCamera = useCallback(async () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream || kind !== "video") return;

    const nextFacing = facingModeRef.current === "user" ? "environment" : "user";
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: nextFacing },
        audio: false,
      });
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return;

      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);

      const oldTrack = stream.getVideoTracks()[0];
      if (oldTrack) {
        stream.removeTrack(oldTrack);
        oldTrack.stop();
      }
      stream.addTrack(newTrack);
      facingModeRef.current = nextFacing;
      // نسخة جديدة من الـ MediaStream (نفس الـ tracks) عشان React يلاحظ
      // التغيير ويحدّث معاينة الكاميرا المحلية.
      setLocalStream(new MediaStream(stream.getTracks()));
    } catch {
      // غالبًا مفيش كاميرا تانية (ديسكتوب مثلاً) — نتجاهل بصمت زي واتساب ويب
    }
  }, [kind]);

  return {
    phase,
    call,
    peerId,
    kind,
    localStream,
    remoteStream,
    muted,
    cameraOff,
    reconnecting,
    error,
    startCall,
    acceptCall,
    declineCall,
    hangUp,
    toggleMute,
    toggleCamera,
    switchCamera,
  };
}
