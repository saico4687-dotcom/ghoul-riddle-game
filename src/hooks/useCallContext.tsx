// Context مشترك لحالة المكالمة عبر كل شاشات الدردشة.
//
// useCall() بيفتح Realtime channel عام بيسمع أي مكالمة واردة، فلازم نسخة
// واحدة بس منه تشتغل في التطبيق كله (مش نسخة جديدة في كل صفحة) — عشان
// كده بنلفّه هنا في Context ونحطه مرة واحدة فوق في ChatLayout، وأي مكوّن
// تحته (زرار الاتصال في المحادثة، شاشة الرنين...) بيستخدم useCallContext()
// عشان يوصل لنفس الحالة.
import { createContext, useContext, type ReactNode } from "react";
import { useCall } from "@/hooks/useCall";

type CallContextValue = ReturnType<typeof useCall>;

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: ReactNode }) {
  const call = useCall();
  return <CallContext.Provider value={call}>{children}</CallContext.Provider>;
}

export function useCallContext(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) {
    throw new Error("useCallContext لازم يُستخدم جوّه <CallProvider>");
  }
  return ctx;
}
