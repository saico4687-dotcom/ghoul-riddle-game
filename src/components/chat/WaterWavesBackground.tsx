// خلفية أمواج مياه داكنة رمادية متحركة — Canvas 2D خفيف (مش فيديو ولا GIF).
// بترسم 8 طبقات موجات متراكبة بسرعات وشفافيات وألوان رمادية مختلفة، مع
// خط ضوء رفيع على قمة كل موجة، عشان تدي إحساس عمق وواقعية أكتر بدون
// تحميل زيادة على المعالج. بتتحدث كل فريم عبر requestAnimationFrame.
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
  { amplitude: 10, wavelength: 150, speed: 0.009, yOffset: 0.46, color: "rgba(120, 120, 126, 0.18)", phase: 0.4 },
  { amplitude: 14, wavelength: 190, speed: 0.013, yOffset: 0.53, color: "rgba(105, 105, 112, 0.22)", phase: 1.1 },
  { amplitude: 18, wavelength: 230, speed: 0.016, yOffset: 0.6, color: "rgba(90, 90, 98, 0.3)", phase: 2.0 },
  { amplitude: 22, wavelength: 270, speed: 0.019, yOffset: 0.67, color: "rgba(75, 75, 84, 0.4)", phase: 0.7 },
  { amplitude: 26, wavelength: 310, speed: 0.022, yOffset: 0.74, color: "rgba(60, 60, 68, 0.5)", phase: 3.2 },
  { amplitude: 20, wavelength: 220, speed: 0.026, yOffset: 0.8, color: "rgba(46, 46, 53, 0.62)", phase: 1.6 },
  { amplitude: 16, wavelength: 170, speed: 0.031, yOffset: 0.86, color: "rgba(32, 32, 38, 0.75)", phase: 4.1 },
  { amplitude: 12, wavelength: 130, speed: 0.038, yOffset: 0.92, color: "rgba(18, 18, 22, 0.88)", phase: 2.6 },
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
      const crestPoints: [number, number][] = [];
      for (let x = 0; x <= width; x += 8) {
        const y =
          baseY +
          Math.sin(x / layer.wavelength + t * layer.speed + layer.phase) * layer.amplitude;
        ctx.lineTo(x, y);
        crestPoints.push([x, y]);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = layer.color;
      ctx.fill();

      // خط رفيع فاتح على قمة الموجة — إحساس ضوء ينعكس على سطح الماء
      // بدل امتلاء رمادي مسطّح، عشان تبقى الأمواج أكتر واقعية.
      ctx.beginPath();
      crestPoints.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.strokeStyle = "rgba(200, 200, 205, 0.14)";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };

    const render = () => {
      if (!running) return;
      const { width, height } = canvas;
      // خلفية داكنة قاعدية رمادية (بحر عميق ليلي بلون رمادي بدل الأزرق)
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#1c1c20");
      grad.addColorStop(1, "#08080a");
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
