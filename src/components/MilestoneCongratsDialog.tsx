import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  tier: 100 | 200;
  onResolved: () => void;
}

/**
 * صفحة "مبروك!" اللي تظهر لحظة ما المستخدم يوصل لأول 100 أو أول 200
 * إجابة صحيحة. بتظهر مرة واحدة فقط لكل عتبة (الباك إند بيمنع تكرارها).
 */
export default function MilestoneCongratsDialog({ tier, onResolved }: Props) {
  const [saving, setSaving] = useState(false);
  const [showSoldBadge, setShowSoldBadge] = useState(false);

  async function resolve(choice: "continue" | "sell") {
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/resolve-riddle-milestone`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tier, choice }),
        },
      );
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        console.error("resolve-riddle-milestone failed", d);
      }

      if (choice === "sell") {
        setShowSoldBadge(true);
        setTimeout(() => onResolved(), 1500);
      } else {
        onResolved();
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white text-black flex flex-col items-center justify-center px-6 gap-8" dir="rtl">
      <h1 className="text-2xl font-bold text-center">
        🎉 مبروك! أنت من أوائل الفائزين بأول {tier} إجابة صحيحة
      </h1>

      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="border border-gray-200 rounded-xl p-5 text-center flex flex-col gap-3">
          <h2 className="font-semibold text-lg">الخيار الأول</h2>
          <p className="text-sm text-gray-600">أكمل المسابقة عاديًا من اللغز التالي مباشرة.</p>
          <button
            disabled={saving}
            onClick={() => resolve("continue")}
            className="bg-black text-white rounded-lg py-3 font-semibold disabled:opacity-50"
          >
            موافق
          </button>
        </div>

        <div className="border border-gray-200 rounded-xl p-5 text-center flex flex-col gap-3 relative">
          <h2 className="font-semibold text-lg">الخيار الثاني</h2>
          <p className="text-sm text-gray-600">
            بيع أول {tier} إجابة صحيحة لـ10 مستخدمين مقابل 50% من أرباح كل عملية بيع تلقائيًا، وتكمل اللعب عادي في نفس الوقت.
          </p>
          {showSoldBadge && (
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-500 text-white text-xs px-3 py-1 rounded-full shadow">
              ✓ تم عرض البيع
            </span>
          )}
          <button
            disabled={saving}
            onClick={() => resolve("sell")}
            className="bg-black text-white rounded-lg py-3 font-semibold disabled:opacity-50"
          >
            موافق
          </button>
        </div>
      </div>

      <button
        onClick={() => (window.location.href = "/support")}
        className="text-sm text-gray-500 underline"
      >
        خدمة العملاء
      </button>
    </div>
  );
}
