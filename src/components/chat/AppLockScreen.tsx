// شاشة قفل الدردشة — بتتعرض بدل المحتوى لو القفل مفعّل ومقفول حاليًا.
// فيها إدخال رمز (4-6 أرقام) يتحقق منه عبر RPC، وزر اختياري لفتح
// بالبصمة/الوجه لو الجهاز عنده Platform Authenticator (WebAuthn).
//
// ملحوظة عن البصمة: الـ Credential بيتسجل مرة واحدة محليًا (ID بيتخزن
// في localStorage بتاع الجهاز ده بس) ويُستخدم بعد كده كبوابة تحقق محلي
// (User Verification) من نظام التشغيل نفسه — مش قناة تحقق إضافية على
// السيرفر. الرمز السري الحقيقي المتحقق منه في الداتابيز يفضل الـ PIN.

import { useState } from "react";
import { Lock, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";

const BIOMETRIC_CRED_KEY = "chat_app_lock_biometric_cred_v1";

async function biometricAvailable() {
  return (
    typeof window !== "undefined" &&
    !!window.PublicKeyCredential &&
    (await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.().catch(() => false))
  );
}

export async function registerBiometric() {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "قفل الدردشة" },
      user: { id: userId, name: "chat-lock", displayName: "قفل الدردشة" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
      timeout: 30000,
    },
  });
  if (cred && (cred as any).rawId) {
    const idB64 = btoa(String.fromCharCode(...new Uint8Array((cred as any).rawId)));
    localStorage.setItem(BIOMETRIC_CRED_KEY, idB64);
    return true;
  }
  return false;
}

export function hasBiometricSetup() {
  return !!localStorage.getItem(BIOMETRIC_CRED_KEY);
}

async function verifyBiometric() {
  const idB64 = localStorage.getItem(BIOMETRIC_CRED_KEY);
  if (!idB64) return false;
  const rawId = Uint8Array.from(atob(idB64), (c) => c.charCodeAt(0));
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ id: rawId, type: "public-key" }],
        userVerification: "required",
        timeout: 30000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}

interface Props {
  onVerify: (pin: string) => Promise<boolean>;
  onUnlocked: () => void;
}

export default function AppLockScreen({ onVerify, onUnlocked }: Props) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);

  const submit = async () => {
    if (pin.length < 4) return;
    setChecking(true);
    setError("");
    const ok = await onVerify(pin);
    setChecking(false);
    if (ok) {
      onUnlocked();
    } else {
      setError("رمز غير صحيح");
      setPin("");
    }
  };

  const tryBiometric = async () => {
    if (!hasBiometricSetup()) return;
    if (!(await biometricAvailable())) return;
    const ok = await verifyBiometric();
    if (ok) onUnlocked();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-background/95 backdrop-blur-md" dir="rtl">
      <div className="flex flex-col items-center gap-2 text-foreground">
        <Lock className="w-10 h-10 text-primary" />
        <h1 className="font-horror text-xl">الدردشة مقفولة</h1>
        <p className="text-sm text-muted-foreground font-typewriter">ادخل الرمز للمتابعة</p>
      </div>

      <input
        type="password"
        inputMode="numeric"
        maxLength={6}
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        className="w-40 text-center text-2xl tracking-[0.5em] bg-card border border-border rounded-lg py-3 text-foreground"
        autoFocus
      />

      {error && <p className="text-destructive text-sm font-typewriter">{error}</p>}

      <Button onClick={submit} disabled={checking || pin.length < 4} className="w-40">
        {checking ? "جاري التحقق..." : "فتح"}
      </Button>

      {hasBiometricSetup() && (
        <button
          onClick={tryBiometric}
          className="flex items-center gap-2 text-sm text-primary font-typewriter"
        >
          <Fingerprint className="w-5 h-5" />
          فتح بالبصمة
        </button>
      )}
    </div>
  );
}
