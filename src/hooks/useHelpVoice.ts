import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { mediaConstraintsFor, stopStream } from "@/lib/chat/webrtc";
import { loadRtcConfig } from "@/lib/chat/iceConfig";

// صوت "استعين بصديق": WebRTC بين اللاعبين، والإشارة (offer/answer/ICE) بتعدي على قناة
// Realtime Broadcast اسمها فيها مفتاح سري ما بيعرفوش غير الاتنين.
// الصوت best-effort: لو فشل، المساعدة بالتلميح بتكمل عادي.

export type HelpVoiceState = "idle" | "connecting" | "connected" | "failed" | "denied";

type Sig = { type: "offer" | "answer" | "ice" | "hangup"; sdp?: string; candidate?: RTCIceCandidateInit };

interface Opts {
  requestId: string | null;
  sessionKey: string | null;
  role: "asker" | "helper";
  enabled: boolean;
}

export function useHelpVoice({ requestId, sessionKey, role, enabled }: Opts) {
  const [state, setState] = useState<HelpVoiceState>("idle");
  const [muted, setMuted] = useState(false);
  const [needsTap, setNeedsTap] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chanRef = useRef<RealtimeChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingIce = useRef<RTCIceCandidateInit[]>([]);
  const gotAnswer = useRef(false);
  const mutedRef = useRef(false);

  const send = useCallback((sig: Sig) => {
    void chanRef.current?.send({ type: "broadcast", event: "sig", payload: sig });
  }, []);

  const playRemote = useCallback((stream: MediaStream) => {
    if (!audioRef.current) {
      const a = document.createElement("audio");
      a.autoplay = true;
      (a as HTMLAudioElement & { playsInline?: boolean }).playsInline = true;
      audioRef.current = a;
    }
    audioRef.current.srcObject = stream;
    audioRef.current.play().then(
      () => setNeedsTap(false),
      () => setNeedsTap(true),
    );
  }, []);

  const tapToPlay = useCallback(() => {
    audioRef.current?.play().then(
      () => setNeedsTap(false),
      () => {},
    );
  }, []);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    streamRef.current?.getAudioTracks().forEach((t) => (t.enabled = !mutedRef.current));
  }, []);

  useEffect(() => {
    if (!enabled || !requestId || !sessionKey) return;

    let disposed = false;
    let offerTimer: ReturnType<typeof setInterval> | null = null;
    gotAnswer.current = false;
    pendingIce.current = [];
    setState("connecting");
    setNeedsTap(false);

    const makePc = async (): Promise<RTCPeerConnection | null> => {
      if (pcRef.current) return pcRef.current;
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(mediaConstraintsFor("audio"));
      } catch {
        if (!disposed) setState("denied");
        return null;
      }
      if (disposed) {
        stopStream(stream);
        return null;
      }
      streamRef.current = stream;
      stream.getAudioTracks().forEach((t) => (t.enabled = !mutedRef.current));
      const rtcCfg = await loadRtcConfig();
      if (disposed) {
        stopStream(stream);
        streamRef.current = null;
        return null;
      }
      if (pcRef.current) return pcRef.current; // نداء متزامن تاني سبقنا
      const pc = new RTCPeerConnection(rtcCfg);
      pcRef.current = pc;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      pc.ontrack = (ev) => {
        if (ev.streams[0]) playRemote(ev.streams[0]);
      };
      pc.onicecandidate = (ev) => {
        if (ev.candidate) send({ type: "ice", candidate: ev.candidate.toJSON() });
      };
      pc.onconnectionstatechange = () => {
        if (disposed) return;
        if (pc.connectionState === "connected") setState("connected");
        else if (pc.connectionState === "failed") setState("failed");
      };
      return pc;
    };

    const flushIce = async (pc: RTCPeerConnection) => {
      const list = pendingIce.current;
      pendingIce.current = [];
      for (const c of list) {
        try {
          await pc.addIceCandidate(c);
        } catch {
          /* تجاهل */
        }
      }
    };

    const onSig = async (sig: Sig) => {
      if (disposed || !sig) return;
      try {
        if (sig.type === "offer" && role === "asker" && sig.sdp) {
          if (pcRef.current?.remoteDescription) return; // offer مكرر
          const pc = await makePc();
          if (!pc) return;
          await pc.setRemoteDescription({ type: "offer", sdp: sig.sdp });
          await flushIce(pc);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          send({ type: "answer", sdp: answer.sdp });
        } else if (sig.type === "answer" && role === "helper" && sig.sdp) {
          const pc = pcRef.current;
          if (!pc || gotAnswer.current) return;
          gotAnswer.current = true;
          if (offerTimer) clearInterval(offerTimer);
          await pc.setRemoteDescription({ type: "answer", sdp: sig.sdp });
          await flushIce(pc);
        } else if (sig.type === "ice" && sig.candidate) {
          const pc = pcRef.current;
          if (pc?.remoteDescription) await pc.addIceCandidate(sig.candidate).catch(() => {});
          else pendingIce.current.push(sig.candidate);
        } else if (sig.type === "hangup") {
          setState("idle");
        }
      } catch {
        if (!disposed) setState("failed");
      }
    };

    const channel = supabase.channel(`help:${requestId}:${sessionKey}`, {
      config: { broadcast: { self: false } },
    });
    chanRef.current = channel;
    channel.on("broadcast", { event: "sig" }, ({ payload }) => void onSig(payload as Sig));
    channel.subscribe(async (status) => {
      if (disposed || status !== "SUBSCRIBED") return;
      if (role !== "helper") return;
      // المساعد هو اللي بيتصل: بيعمل offer ويكرره كل 3 ثواني لحد ما الطالب يرد.
      const pc = await makePc();
      if (!pc || disposed) return;
      let tries = 0;
      const sendOffer = async () => {
        if (disposed || gotAnswer.current || tries >= 8) {
          if (offerTimer) clearInterval(offerTimer);
          if (!gotAnswer.current && tries >= 8 && !disposed) setState("failed");
          return;
        }
        tries++;
        try {
          if (!pc.localDescription) {
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
          }
          send({ type: "offer", sdp: pc.localDescription?.sdp });
        } catch {
          /* هنحاول تاني */
        }
      };
      await sendOffer();
      offerTimer = setInterval(() => void sendOffer(), 3000);
    });

    return () => {
      disposed = true;
      if (offerTimer) clearInterval(offerTimer);
      try {
        send({ type: "hangup" });
      } catch {
        /* تجاهل */
      }
      try {
        pcRef.current?.close();
      } catch {
        /* تجاهل */
      }
      pcRef.current = null;
      stopStream(streamRef.current);
      streamRef.current = null;
      if (audioRef.current) {
        audioRef.current.srcObject = null;
        audioRef.current = null;
      }
      const ch = chanRef.current;
      chanRef.current = null;
      if (ch) setTimeout(() => void supabase.removeChannel(ch), 300);
      setState("idle");
    };
  }, [enabled, requestId, sessionKey, role, send, playRemote]);

  return { state, muted, needsTap, toggleMute, tapToPlay };
}
