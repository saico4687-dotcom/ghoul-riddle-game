import { useEffect } from "react";
import { BUTTON_SOUNDS, DEFAULT_BUTTON_SOUND } from "@/config/buttonSounds";
import { playSfx } from "@/lib/sfx";

// مستمع واحد على المستند بدل تعديل مئات الأزرار: أي ضغطة على زر بيتدور له على صوت في BUTTON_SOUNDS.
export function useButtonSounds(): void {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      const el = t?.closest?.('button, [role="button"], a[data-sfx]') as HTMLElement | null;
      if (!el) return;
      if ((el as HTMLButtonElement).disabled || el.getAttribute("aria-disabled") === "true") return;
      const label = (el.getAttribute("data-sfx") ?? el.getAttribute("aria-label") ?? el.textContent ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 80);
      const id = BUTTON_SOUNDS[label] ?? DEFAULT_BUTTON_SOUND;
      if (id) playSfx(id);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);
}
