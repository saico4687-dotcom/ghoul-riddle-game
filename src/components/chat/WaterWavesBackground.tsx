// خلفية أمواج مياه داكنة متحركة — Canvas 2D خفيف (مش فيديو ولا GIF).
// النسخة دي بتغطي الشاشة بالكامل من فوق لتحت (مش نص الشاشة بس زي الأول):
// - طبقات موجات كتير (16) متوزّعة من أعلى الشاشة لأسفلها، بتدرّج عمق
//   (فاتح شفاف قرب السطح فوق → غامق كتيم قرب القاع تحت) عشان يدي إحساس
//   حقيقي إنك بتبص جوه بحر عميق مش بس شريط أمواج تحت.
// - بريق ضوء ناعم متحرك (Caustics) بيلمع ببطء تحت السطح، زي انعكاس ضوء
//   حقيقي على قاع البحر.
// - خط رفيع فاتح على قمة كل موجة (زبد/انعكاس) لإحساس عمق أكتر.
// بتتحدث كل فريم عبر requestAnimationFrame، وبتوقف نفسها تلقائيًا لو
// التاب مش ظاهر (توفير بطارية/معالج).

import { useEffect, useRef } from "react";

type WaveLayer = {
  amplitude: number;
  wavelength: number;
  speed: number;
  yOffset: number; // نسبة من ارتفاع الكانفاس (0..1) — من فوق (0) لتحت (1)
  color: string;
  phase: number;
  direction: 1 | -1;
};

// 16 طبقة موزّعة على طول الشاشة بالكامل (من 0.04 قرب أعلى الشاشة لغاية
// 0.99 قرب أسفلها)، بدل ما كانت متكدّسة بس في النص التاني زي الأول.
const LAYER_COUNT = 16;
const LAYERS: WaveLayer[] = Array.from({ length: LAYER_COUNT }, (_, i) => {
  const tRatio = i / (LAYER_COUNT - 1); // 0 (أعلى) → 1 (أسفل)
  const yOffset = 0.04 + tRatio * 0.95;

  // العمق بيزيد كل ما نزلنا تحت: أمواج أكبر وأبطأ وألوان أغمق وأكتم
  const amplitude = 6 + tRatio * 24;
  const wavelength = 130 + tRatio * 220;
  const speed = 0.007 + (1 - tRatio) * 0.02; // الطبقات اللي فوق بتتحرك أسرع شوية (أقرب للسطح)

  // تدرّج لوني من رمادي-أزرق فاتح شفاف قرب السطح، لغاية أسود كتيم قرب القاع
  const lightness = Math.round(120 - tRatio * 108); // 120 → 12
  const alpha = 0.12 + tRatio * 0.78; // 0.12 → 0.9

  return {
    amplitude,
    wavelength,
    speed,
    yOffset,
    color: `rgba(${lightness}, ${lightness + 2}, ${lightness + 8}, ${alpha.toFixed(2)})`,
    phase: i * 0.7,
    direction: i % 2 === 0 ? 1 : -1,
  };
});

// نقاط بريق ضوء ناعمة (Caustics) بتتحرك ببطء تحت الماء — إحساس ضوء
// طبيعي منعكس، مش نمط هندسي واضح.
type Caustic = { x: number; y: number; r: number; speed: number; phase: number };
const CAUSTICS: Caustic[] = [
  { x: 0.2, y: 0.15, r: 220, speed: 0.0006, phase: 0 },
  { x: 0.75, y: 0.3, r: 260, speed: 0.0005, phase: 2 },
  { x: 0.4, y: 0.55, r: 300, speed: 0.0004, phase: 4 },
  { x: 0.85, y: 0.7, r: 240, speed: 0.00055, phase: 1.3 },
  { x: 0.15, y: 0.85, r: 260, speed: 0.00045, phase: 3.1 },
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
          Math.sin(x / layer.wavelength + t * layer.speed * layer.direction + layer.phase) *
            layer.amplitude;
        ctx.lineTo(x, y);
        crestPoints.push([x, y]);
      }
      ctx.lineTo(width, height);
      ctx.closePath();
      ctx.fillStyle = layer.color;
      ctx.fill();

      // خط رفيع فاتح على قمة الموجة — إحساس ضوء ينعكس على سطح الماء
      ctx.beginPath();
      crestPoints.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
      ctx.strokeStyle = "rgba(210, 220, 230, 0.10)";
      ctx.lineWidth = 1;
      ctx.stroke();
    };

    const drawCaustics = () => {
      const { width, height } = canvas;
      ctx.save();
      ctx.globalCompositeOperation = "screen";
      for (const c of CAUSTICS) {
        const cx = c.x * width + Math.sin(t * c.speed + c.phase) * width * 0.06;
        const cy = c.y * height + Math.cos(t * c.speed * 0.8 + c.phase) * height * 0.05;
        const flicker = 0.55 + 0.45 * Math.sin(t * c.speed * 3 + c.phase);
        const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.r);
        grad.addColorStop(0, `rgba(140, 170, 190, ${0.05 * flicker})`);
        grad.addColorStop(1, "rgba(140, 170, 190, 0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
      ctx.restore();
    };

    const render = () => {
      if (!running) return;
      const { width, height } = canvas;

      // خلفية داكنة قاعدية (بحر عميق ليلي) — فاتح شوية فوق وغامق تمامًا تحت
      const grad = ctx.createLinearGradient(0, 0, 0, height);
      grad.addColorStop(0, "#2a2c32");
      grad.addColorStop(0.4, "#17181c");
      grad.addColorStop(1, "#050506");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      // بريق ضوء تحت الماء قبل طبقات الأمواج عشان يبان تحتها
      drawCaustics();

      for (const layer of LAYERS) drawLayer(layer);

      // Vignette خفيف جدًا على الحواف لإحساس عمق إضافي
      const vignette = ctx.createRadialGradient(
        width / 2,
        height / 2,
        Math.min(width, height) * 0.3,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.75
      );
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, width, height);

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
