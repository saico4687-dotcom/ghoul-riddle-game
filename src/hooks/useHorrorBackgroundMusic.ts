import { useCallback, useRef, useState } from "react";
import riddleBgMusic from "@/assets/audio/riddle-bg-music.mp3";

/**
 * موسيقى خلفية حقيقية (ملف mp3) تشتغل أثناء وقت التفكير في اللغز:
 * تبدأ بعد ما ينتهي صوت الآلة الكاتبة (كتابة نص اللغز)، وتتوقف فورًا
 * لحظة ما المستخدم يدوس "تحقق من الإجابة" (أو ينتهي الوقت).
 */
export const useHorrorBackgroundMusic = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState(0.5);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const getAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio(riddleBgMusic);
      audio.loop = true;
      audio.volume = volume;
      audioRef.current = audio;
    }
    return audioRef.current;
  }, [volume]);

  const startMusic = useCallback(() => {
    const audio = getAudio();
    audio.currentTime = 0;
    void audio.play().catch(() => {
      // التشغيل التلقائي ممكن يتمنع لو مفيش تفاعل مستخدم لسه؛ هيشتغل
      // عادي بعد أول لمسة على الشاشة.
    });
    setIsPlaying(true);
  }, [getAudio]);

  const stopMusic = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  const setVolume = useCallback((newVolume: number) => {
    setVolumeState(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = audioRef.current.volume > 0 ? 0 : volume;
  }, [volume]);

  return {
    isPlaying,
    startMusic,
    stopMusic,
    volume,
    setVolume,
    toggleMute,
  };
};
