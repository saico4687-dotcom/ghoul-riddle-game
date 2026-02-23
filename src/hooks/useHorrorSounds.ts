import { useCallback, useRef } from "react";

export const useHorrorSounds = () => {
  const audioContextRef = useRef<AudioContext | null>(null);
  const isMutedRef = useRef(false);

  const setMuted = useCallback((muted: boolean) => {
    isMutedRef.current = muted;
  }, []);

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Evil laugh - multiple layered oscillators for creepy effect
  const playEvilLaugh = useCallback(() => {
    if (isMutedRef.current) return;
    
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Create multiple laugh "ha" sounds
    for (let i = 0; i < 5; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(800, now);
      
      const startTime = now + i * 0.25;
      const baseFreq = 150 - i * 10;
      
      // Each "ha" starts high and drops
      osc.frequency.setValueAtTime(baseFreq + 50, startTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq - 30, startTime + 0.2);
      
      osc.type = "sawtooth";
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.15, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);
      
      osc.start(startTime);
      osc.stop(startTime + 0.25);
    }
    
    // Add creepy undertone
    const undertone = ctx.createOscillator();
    const undertoneGain = ctx.createGain();
    undertone.connect(undertoneGain);
    undertoneGain.connect(ctx.destination);
    
    undertone.type = "sine";
    undertone.frequency.setValueAtTime(80, now);
    undertoneGain.gain.setValueAtTime(0.08, now);
    undertoneGain.gain.exponentialRampToValueAtTime(0.001, now + 1.5);
    
    undertone.start(now);
    undertone.stop(now + 1.5);
  }, [getAudioContext]);

  // Child crying - sad wavering tones
  const playChildCry = useCallback(() => {
    if (isMutedRef.current) return;
    
    const ctx = getAudioContext();
    const now = ctx.currentTime;
    
    // Create crying sounds - wavering high-pitched tones
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      const startTime = now + i * 0.4;
      const baseFreq = 600 + Math.random() * 100;
      
      // Vibrato for crying effect
      vibrato.frequency.setValueAtTime(6, startTime);
      vibratoGain.gain.setValueAtTime(30, startTime);
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq, startTime);
      osc.frequency.exponentialRampToValueAtTime(baseFreq - 150, startTime + 0.35);
      
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(0.12, startTime + 0.05);
      gain.gain.setValueAtTime(0.12, startTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.35);
      
      osc.start(startTime);
      osc.stop(startTime + 0.4);
      vibrato.start(startTime);
      vibrato.stop(startTime + 0.4);
    }
    
    // Add sobbing undertone
    const sob = ctx.createOscillator();
    const sobGain = ctx.createGain();
    const sobFilter = ctx.createBiquadFilter();
    
    sob.connect(sobFilter);
    sobFilter.connect(sobGain);
    sobGain.connect(ctx.destination);
    
    sobFilter.type = "lowpass";
    sobFilter.frequency.setValueAtTime(400, now);
    
    sob.type = "sawtooth";
    sob.frequency.setValueAtTime(200, now);
    sob.frequency.linearRampToValueAtTime(150, now + 2);
    
    sobGain.gain.setValueAtTime(0.03, now);
    sobGain.gain.exponentialRampToValueAtTime(0.001, now + 2);
    
    sob.start(now);
    sob.stop(now + 2);
  }, [getAudioContext]);

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

  const playSound = useCallback((type: "correct" | "wrong" | "typewriter" | "ambient") => {
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
    }
  }, [playEvilLaugh, playChildCry, playTypewriter, playHorrorAmbient]);

  return {
    playSound,
    setMuted,
  };
};
