// صوت تحذير قصير (مؤقت): بيتولّد بالكود من غير ملف. في مرحلة الأصوات هنبدّله بصوت من Supabase.
// بيفشل بهدوء لو المتصفح منع الصوت.

export function playWarningSound(): void {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    const t0 = ctx.currentTime;
    // 3 نغمات هابطة سريعة (تحذير).
    [880, 660, 880].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = "square";
      o.frequency.value = f;
      o.connect(gain);
      const s = t0 + i * 0.22;
      gain.gain.setValueAtTime(0.0001, s);
      gain.gain.exponentialRampToValueAtTime(0.25, s + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, s + 0.18);
      o.start(s);
      o.stop(s + 0.2);
    });
    setTimeout(() => void ctx.close().catch(() => {}), 1200);
  } catch {
    /* تجاهل */
  }
}
