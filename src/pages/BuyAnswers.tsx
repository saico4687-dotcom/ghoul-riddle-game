import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { purchaseProduct } from "@/lib/billing";

type Tier = 100 | 200;
type Offer = {
  offer_id: string;
  seller_id: string;
  username: string;
  avatar_url: string | null;
  price_egp: number;
  slots_left: number;
};

/**
 * صفحة "شراء الإجابات": زرين (100 / 200)، وعند الضغط تظهر إما قائمة
 * البائعين الحقيقيين المؤهلين، أو تدفع مباشرة (صاحب التطبيق) لو
 * لسه مفيش بائعين لهذه الشريحة.
 */
export default function BuyAnswers() {
  const navigate = useNavigate();
  const [selectedTier, setSelectedTier] = useState<Tier | null>(null);
  const [offers, setOffers] = useState<Offer[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [buyingId, setBuyingId] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedTier) return;
    setLoading(true);
    supabase
      .rpc("list_active_riddle_offers", { _tier: selectedTier })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setOffers((data as Offer[]) ?? []);
        setLoading(false);
      });
  }, [selectedTier]);

  async function buyFrom(tier: Tier, offerId: string | null) {
    setBuyingId(offerId ?? "official");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id ?? null;
      if (!userId) {
        alert("سجّل الدخول أولاً.");
        return;
      }

      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reserve-riddle-purchase`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ tier, offer_id: offerId }),
        },
      );
      const reserveData = await res.json();
      if (!res.ok) {
        alert(reserveData?.error ?? "تعذر إتمام العملية، حاول مرة أخرى.");
        return;
      }

      const product = tier === 100 ? "answers_100" : "answers_200";
      await purchaseProduct(product, userId, () => {
        // بعد نجاح الدفع (الويبهوك بيفتح التقدم فعليًا)، ودّيه على البدء مباشرة
        navigate("/", { replace: true });
      });
    } finally {
      setBuyingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-white text-black flex flex-col items-center px-4 py-10 gap-6" dir="rtl">
      <h1 className="text-2xl font-bold">شراء الإجابات الصحيحة</h1>

      {!selectedTier && (
        <div className="flex flex-col gap-4 w-full max-w-sm">
          <button
            onClick={() => setSelectedTier(100)}
            className="bg-black text-white rounded-xl py-4 text-lg font-semibold"
          >
            شراء أول 100 إجابة صحيحة — 50 جنيه
          </button>
          <button
            onClick={() => setSelectedTier(200)}
            className="bg-black text-white rounded-xl py-4 text-lg font-semibold"
          >
            شراء أول 200 إجابة صحيحة — 100 جنيه
          </button>
        </div>
      )}

      {selectedTier && (
        <div className="w-full max-w-sm flex flex-col gap-4">
          <button onClick={() => setSelectedTier(null)} className="self-start text-sm text-gray-500">
            ← رجوع
          </button>

          {loading && <p className="text-center text-gray-500">جاري التحميل...</p>}

          {!loading && offers && offers.length === 0 && (
            <button
              onClick={() => buyFrom(selectedTier, null)}
              disabled={buyingId !== null}
              className="border border-black rounded-xl py-4 font-semibold disabled:opacity-50"
            >
              اشترِ الآن — {selectedTier === 100 ? 50 : 100} جنيه
            </button>
          )}

          {!loading &&
            offers &&
            offers.map((o) => (
              <div
                key={o.offer_id}
                className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  {o.avatar_url && (
                    <img src={o.avatar_url} className="w-8 h-8 rounded-full" alt="" />
                  )}
                  <span className="font-medium">{o.username}</span>
                  <span className="text-xs text-gray-400">({o.slots_left} متبقي)</span>
                </div>
                <button
                  onClick={() => buyFrom(selectedTier, o.offer_id)}
                  disabled={buyingId !== null}
                  className="bg-black text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
                >
                  اشترِ
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
