import { useCallback, useRef, useEffect, useState } from "react";

export const useHorrorBackgroundMusic = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.5);
  const audioContextRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const nodesRef = useRef<{
    drones: OscillatorNode[];
    lfo: OscillatorNode | null;
    heartbeat: OscillatorNode | null;
    intervals: ReturnType<typeof setInterval>[];
  }>({
    drones: [],
    lfo: null,
    heartbeat: null,
    intervals: [],
  });

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContextRef.current;
  }, []);

  // Create deep dark drone
  const createDrone = useCallback((ctx: AudioContext, masterGain: GainNode, frequency: number, gainValue: number) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(150, ctx.currentTime);
    filter.Q.setValueAtTime(2, ctx.currentTime);

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(gainValue, ctx.currentTime + 3);

    osc.start();
    return osc;
  }, []);

  // Create funeral organ sound
  const createOrgan = useCallback((ctx: AudioContext, masterGain: GainNode) => {
    const frequencies = [55, 82.5, 110, 165]; // Deep organ pipes
    const oscillators: OscillatorNode[] = [];

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGain);

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(200 + i * 50, ctx.currentTime);

      osc.type = i % 2 === 0 ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      // Slow vibrato for organ effect
      const vibrato = ctx.createOscillator();
      const vibratoGain = ctx.createGain();
      vibrato.connect(vibratoGain);
      vibratoGain.connect(osc.frequency);
      vibrato.frequency.setValueAtTime(0.5, ctx.currentTime);
      vibratoGain.gain.setValueAtTime(2, ctx.currentTime);
      vibrato.start();

      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.03 - i * 0.005, ctx.currentTime + 4);

      osc.start();
      oscillators.push(osc);
    });

    return oscillators;
  }, []);

  // Play slow death drums
  const playDeathDrum = useCallback((ctx: AudioContext, masterGain: GainNode) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(80, ctx.currentTime);

    osc.type = "sine";
    osc.frequency.setValueAtTime(40, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(20, ctx.currentTime + 1.5);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);

    osc.start();
    osc.stop(ctx.currentTime + 1.5);

    // Secondary impact
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(60, ctx.currentTime);
    osc2.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.8);
    gain2.gain.setValueAtTime(0.08, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    osc2.start();
    osc2.stop(ctx.currentTime + 0.8);
  }, []);

  // Play mysterious whispers
  const playWhisper = useCallback((ctx: AudioContext, masterGain: GainNode) => {
    const bufferSize = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Create filtered noise for whisper effect
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.sin(i / 500) * Math.sin(i / 1000);
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    const filter2 = ctx.createBiquadFilter();

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(filter2);
    filter2.connect(gain);
    gain.connect(masterGain);

    filter.type = "bandpass";
    filter.frequency.setValueAtTime(800, ctx.currentTime);
    filter.Q.setValueAtTime(5, ctx.currentTime);

    filter2.type = "highpass";
    filter2.frequency.setValueAtTime(400, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.02, ctx.currentTime + 0.5);
    gain.gain.setValueAtTime(0.02, ctx.currentTime + 1.5);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 2);

    source.start();
    source.stop(ctx.currentTime + 2);
  }, []);

  // Play distant bell
  const playBell = useCallback((ctx: AudioContext, masterGain: GainNode) => {
    const frequencies = [200, 400, 600, 800, 1000];

    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(masterGain);

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);

      const volume = 0.015 / (i + 1);
      gain.gain.setValueAtTime(volume, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 4 - i * 0.5);

      osc.start();
      osc.stop(ctx.currentTime + 4);
    });
  }, []);

  // Play distant thunder
  const playThunder = useCallback((ctx: AudioContext, masterGain: GainNode) => {
    const bufferSize = ctx.sampleRate * 3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      const envelope = Math.exp(-i / (ctx.sampleRate * 0.8));
      data[i] = (Math.random() * 2 - 1) * envelope;
    }

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    source.buffer = buffer;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    filter.type = "lowpass";
    filter.frequency.setValueAtTime(100, ctx.currentTime);

    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.06, ctx.currentTime + 0.1);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 3);

    source.start();
    source.stop(ctx.currentTime + 3);
  }, []);

  // Play heartbeat
  const playHeartbeat = useCallback((ctx: AudioContext, masterGain: GainNode) => {
    // First beat (lub)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(masterGain);
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(50, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.15);
    gain1.gain.setValueAtTime(0.08, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
    osc1.start();
    osc1.stop(ctx.currentTime + 0.15);

    // Second beat (dub)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(masterGain);
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(40, ctx.currentTime + 0.2);
    osc2.frequency.exponentialRampToValueAtTime(25, ctx.currentTime + 0.35);
    gain2.gain.setValueAtTime(0.06, ctx.currentTime + 0.2);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc2.start(ctx.currentTime + 0.2);
    osc2.stop(ctx.currentTime + 0.35);
  }, []);

  const startMusic = useCallback(() => {
    if (isPlaying) return;

    const ctx = getAudioContext();
    
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Master gain for volume control
    const masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);
    masterGain.gain.setValueAtTime(volume, ctx.currentTime);
    masterGainRef.current = masterGain;

    // Create continuous drones
    const drone1 = createDrone(ctx, masterGain, 35, 0.06); // Ultra deep
    const drone2 = createDrone(ctx, masterGain, 52.5, 0.04); // Deep
    const drone3 = createDrone(ctx, masterGain, 70, 0.03); // Mid-low

    nodesRef.current.drones = [drone1, drone2, drone3];

    // Create organ layer
    const organOscs = createOrgan(ctx, masterGain);
    nodesRef.current.drones.push(...organOscs);

    // Schedule random effects
    const intervals: ReturnType<typeof setInterval>[] = [];

    // Death drums every 4-6 seconds
    const drumInterval = setInterval(() => {
      if (audioContextRef.current && audioContextRef.current.state === "running") {
        playDeathDrum(audioContextRef.current, masterGainRef.current!);
      }
    }, 4000 + Math.random() * 2000);
    intervals.push(drumInterval);

    // Whispers every 8-15 seconds
    const whisperInterval = setInterval(() => {
      if (audioContextRef.current && audioContextRef.current.state === "running") {
        playWhisper(audioContextRef.current, masterGainRef.current!);
      }
    }, 8000 + Math.random() * 7000);
    intervals.push(whisperInterval);

    // Distant bells every 12-20 seconds
    const bellInterval = setInterval(() => {
      if (audioContextRef.current && audioContextRef.current.state === "running") {
        playBell(audioContextRef.current, masterGainRef.current!);
      }
    }, 12000 + Math.random() * 8000);
    intervals.push(bellInterval);

    // Thunder every 20-40 seconds
    const thunderInterval = setInterval(() => {
      if (audioContextRef.current && audioContextRef.current.state === "running" && Math.random() > 0.3) {
        playThunder(audioContextRef.current, masterGainRef.current!);
      }
    }, 20000 + Math.random() * 20000);
    intervals.push(thunderInterval);

    // Heartbeat every 15-30 seconds (irregular)
    const heartbeatInterval = setInterval(() => {
      if (audioContextRef.current && audioContextRef.current.state === "running" && Math.random() > 0.4) {
        playHeartbeat(audioContextRef.current, masterGainRef.current!);
      }
    }, 15000 + Math.random() * 15000);
    intervals.push(heartbeatInterval);

    nodesRef.current.intervals = intervals;

    // Play initial effects
    setTimeout(() => {
      if (audioContextRef.current && masterGainRef.current) {
        playDeathDrum(audioContextRef.current, masterGainRef.current);
      }
    }, 2000);

    setIsPlaying(true);
  }, [isPlaying, volume, getAudioContext, createDrone, createOrgan, playDeathDrum, playWhisper, playBell, playThunder, playHeartbeat]);

  const stopMusic = useCallback(() => {
    // Clear all intervals
    nodesRef.current.intervals.forEach((interval) => clearInterval(interval));
    nodesRef.current.intervals = [];

    // Stop all oscillators
    nodesRef.current.drones.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {
        // Oscillator might already be stopped
      }
    });
    nodesRef.current.drones = [];

    // Disconnect master gain
    if (masterGainRef.current) {
      masterGainRef.current.disconnect();
      masterGainRef.current = null;
    }

    setIsPlaying(false);
  }, []);

  const updateVolume = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (masterGainRef.current && audioContextRef.current) {
      masterGainRef.current.gain.setValueAtTime(newVolume, audioContextRef.current.currentTime);
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (masterGainRef.current && audioContextRef.current) {
      const currentGain = masterGainRef.current.gain.value;
      if (currentGain > 0) {
        masterGainRef.current.gain.setValueAtTime(0, audioContextRef.current.currentTime);
      } else {
        masterGainRef.current.gain.setValueAtTime(volume, audioContextRef.current.currentTime);
      }
    }
  }, [volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopMusic();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopMusic]);

  return {
    isPlaying,
    startMusic,
    stopMusic,
    volume,
    setVolume: updateVolume,
    toggleMute,
  };
};
