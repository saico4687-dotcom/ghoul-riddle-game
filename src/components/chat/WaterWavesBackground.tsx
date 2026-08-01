// خلفية أمواج مياه داكنة متحركة — Canvas 2D خفيف (مش فيديو ولا GIF).
// بترسم 3 طبقات موجات متراكبة بسرعات وشفافيات مختلفة عشان يديك
// إحساس عمق، وبتتحدث كل فريم عبر requestAnimationFrame.
// الكومبوننت ده بيتحط ثابت (fixed) وراء المحتوى كله في ChatLayout،
// وبيوقف نفسه تلقائيًا لو التاب مش ظاهر (توفير بطارية/معالج).

import { useEffect, useRef } from "react";

type WaveLayer = {
  amplitude: number;
  wavelength: number;
  speed: number;
  yOffset: number; // نسبة من ارتفاع الكانفاس (0..1)
  color: string;
  phase: number;
};

const LAYERS: WaveLayer[] = [
  { amplitude: 18, wavelength: 260, speed: 0.012, yOffset: 0.62, color: "rgba(30, 58, 95, 0.55)", phase: 0 },
  { amplitude: 26, wavelength: 340, speed: 0.02, yOffset: 0.74, color: "rgba(18, 40, 70, 0.6)", phase: 2 },
  { amplitude: 14, wavelength: 180, speed: 0.03, yOffset: 0.85, color: "rgba(8, 22, 45, 0.75)", phase: 4 },
];

export default function WaterWavesBackground() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let running = true;
    let t = 0;

    const resize = () => {
      canvas.width = window.innerWidth * Math.min(window.devicePixelRatio || 1, 2);
      canvas.height = window.innerHeight * Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width = "100%";
      canvas.style.height = "100%";
    };
    resize();
    window.addEventListener("resize", resize);

    const drawLayer = (layer: WaveLayer) => {
      const { width, height } = canvas;
      const baseY = height * layer.yOffset;
      ctx.beginPath();
      ctx.moveTo(0, height);
      for (let x = 0; x <= width; x += 8) {
        const y =
          baseY +
          Math.sin(x / layer.wavelength + t * layer.speed + layer.phase) * layer.amplitude;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = layer.color;
      ctx.fill();
    };

    const render = () => {
      if (!running) return;
      const { width, height } = canvas;
      // خلفية داكنة قاعدية (بحر عميق ليلي)
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#0b1220");
      grad.addColorStop(1, "#020509");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      for (const layer of LAYERS) drawLayer(layer);

      t += 1;
      raf = requestAnimationFrame(render);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        raf = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    raf = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 -z-10 pointer-events-none"
    />
  );
}
