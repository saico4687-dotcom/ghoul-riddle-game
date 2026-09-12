import { useCallback, useEffect, useRef } from "react";
import correctSound from "@/assets/audio/answer-correct-yes.mp3";
import wrongSound from "@/assets/audio/answer-wrong-noo.mp3";

export const useHorrorSounds = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isMutedRef = useRef(false);
  const correctAudioRef = useRef<HTMLAudioElement | null>(null);
  const wrongAudioRef = useRef<HTMLAudioElement | null>(null);

  const setMuted = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    // متصفحات كتير (خصوصًا على الموبايل) بتوقف الـ AudioContext تلقائيًا
    // (state = "suspended") لما التطبيق يروح للخلفية، أو لما إعلان
    // (Interstitial/Rewarded) ياخد الفوكس مؤقتًا، أو حتى أول ما بيتعمل
    // إنشاء للـ context قبل أي user gesture. من غير الـ resume() ده،
    // أي صوت مجدول بعد كده (تكة الساعة، الطباعة، ...) بيتجدول فعلاً
    // من غير ما يتسمع أبدًا — وده كان سبب توقف صوت دقات الساعة.
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  // نحاول نرجّع الـ context لحالة "running" في أي لحظة يرجع فيها
  // التطبيق للواجهة (بعد إغلاق إعلان، أو رجوع من الخلفية)، مش بس
  // وقت تشغيل صوت جديد — عشان الساعة اللي بتشتغل بـ setInterval
  // ماتفضلش صامتة لحد ما حدث تاني يحصل يستدعي getAudioContext.
  useEffect(() => {
    const resumeIfNeeded = () => {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state === "suspended") {
        void ctx.resume().catch(() => {});
      }
    };

    document.addEventListener("visibilitychange", resumeIfNeeded);
    window.addEventListener("focus", resumeIfNeeded);
    window.addEventListener("pointerdown", resumeIfNeeded);

    return () => {
      document.removeEventListener("visibilitychange", resumeIfNeeded);
      window.removeEventListener("focus", resumeIfNeeded);
      window.removeEventListener("pointerdown", resumeIfNeeded);
    };
  }, []);

  // إجابة صحيحة — صوت حقيقي "Yes"
  const playEvilLaugh = useCallback(() => {
    if (isMutedRef.current) return;

    if (!correctAudioRef.current) {
      correctAudioRef.current = new Audio(correctSound);
    }
    const audio = correctAudioRef.current;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, []);

  // إجابة خاطئة — صوت حقيقي "Noo"
  const playChildCry = useCallback(() => {
    if (isMutedRef.current) return;

    if (!wrongAudioRef.current) {
      wrongAudioRef.current = new Audio(wrongSound);
    }
    const audio = wrongAudioRef.current;
    audio.currentTime = 0;
    void audio.play().catch(() => {});
  }, []);

  // Typewriter click - sharp mechanical sound
  const playTypewriter = useCallback(() => {
    if (isMutedRef.current) return;
    
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Click sound
    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    
    click.connect(filter);
    filter.connect(clickGain);
    clickGain.connect(ctx.destination);
    
    filter.type = "highpass";
    filter.frequency.setValueAtTime(2000, now);
    
    click.type = "square";
    click.frequency.setValueAtTime(1500 + Math.random() * 500, now);
    
    clickGain.gain.setValueAtTime(0.08, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);
    
    click.start(now);
    click.stop(now + 0.03);
    
    // Mechanical resonance
    const resonance = ctx.createOscillator();
    const resGain = ctx.createGain();
    
    resonance.connect(resGain);
    resGain.connect(ctx.destination);
    
    resonance.type = "sine";
    resonance.frequency.setValueAtTime(200 + Math.random() * 100, now);
    
    resGain.gain.setValueAtTime(0.02, now);
    resGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
    
    resonance.start(now);
    resonance.stop(now + 0.05);
  }, [getAudioContext]);

  // Clock tick - short dry click, يتكرر كل ثانية أثناء عد اللغز التنازلي
  const playClockTick = useCallback(() => {
    if (isMutedRef.current) return;

    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1800, now);
    filter.Q.setValueAtTime(4, now);

    osc.type = "square";
    osc.frequency.setValueAtTime(1000, now);

    gain.gain.setValueAtTime(0.06, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.start(now);
    osc.stop(now + 0.05);
  }, [getAudioContext]);

  // Horror ambient sound for background
  const playHorrorAmbient = useCallback(() => {
    if (isMutedRef.current) return;
    
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Deep drone
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    const droneFilter = ctx.createBiquadFilter();
    
    drone.connect(droneFilter);
    droneFilter.connect(droneGain);
    droneGain.connect(ctx.destination);
    
    droneFilter.type = "lowpass";
    droneFilter.frequency.setValueAtTime(200, now);
    
    drone.type = "sawtooth";
    drone.frequency.setValueAtTime(50, now);
    drone.frequency.linearRampToValueAtTime(45, now + 2);
    
    droneGain.gain.setValueAtTime(0, now);
    droneGain.gain.linearRampToValueAtTime(0.08, now + 0.5);
    droneGain.gain.setValueAtTime(0.08, now + 1.5);
    droneGain.gain.exponentialRampToValueAtTime(0.001, now + 2);
    
    drone.start(now);
    drone.stop(now + 2);
  }, [getAudioContext]);

  const playSound = useCallback((type: "correct" | "wrong" | "typewriter" | "ambient" | "tick") => {
    switch (type) {
      case "correct":
        playEvilLaugh();
        break;
      case "wrong":
        playChildCry();
        break;
      case "typewriter":
        playTypewriter();
        break;
      case "ambient":
        playHorrorAmbient();
        break;
      case "tick":
        playClockTick();
        break;
    }
  }, [playEvilLaugh, playChildCry, playTypewriter, playHorrorAmbient, playClockTick]);

  return {
    playSound,
    setMuted,
  };
};
