import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  searchUsers,
  sendFriendRequest,
  cancelFriendRequest,
  respondFriendRequest,
  fetchFriendshipStatuses,
  type FriendshipStatus,
} from "@/lib/chat/queries";
import { useAuth } from "@/hooks/useAuth";
import UserAvatar from "@/components/chat/UserAvatar";
import { Loader2, Search as SearchIcon, UserPlus, Check, X, MessageCircle, Ban } from "lucide-react";
import { toast } from "sonner";

type StatusEntry = { status: FriendshipStatus; requestId?: string };

export default function ChatSearch() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [statuses, setStatuses] = useState<Map<string, StatusEntry>>(new Map());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 2) {
      setResults([]);
      setStatuses(new Map());
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const r = await searchUsers(query);
        setResults(r);
        if (user && r.length) {
          const ids = r.map((u: any) => u.user_id);
          const m = await fetchFriendshipStatuses(user.id, ids);
          setStatuses(m);
        } else {
          setStatuses(new Map());
        }
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q, user]);

  const refreshStatuses = async () => {
    if (!user || results.length === 0) return;
    const m = await fetchFriendshipStatuses(user.id, results.map((r) => r.user_id));
    setStatuses(m);
  };

  const handleSend = async (uid: string) => {
    setBusy(uid);
    try {
      await sendFriendRequest(uid);
      toast.success("تم إرسال طلب الصداقة");
      await refreshStatuses();
    } catch (e: any) {
      toast.error(e.message || "تعذّر الإرسال");
    } finally {
      setBusy(null);
    }
  };

  const handleCancel = async (uid: string, requestId?: string) => {
    if (!requestId) return;
    setBusy(uid);
    try {
      await cancelFriendRequest(requestId);
      toast.success("تم إلغاء الطلب");
      await refreshStatuses();
    } finally {
      setBusy(null);
    }
  };

  const handleRespond = async (uid: string, requestId: string | undefined, accept: boolean) => {
    if (!requestId) return;
    setBusy(uid);
    try {
      await respondFriendRequest(requestId, accept);
      toast.success(accept ? "تمت إضافة الصديق" : "تم الرفض");
      await refreshStatuses();
    } finally {
      setBusy(null);
    }
  };

  const empty = useMemo(() => !loading && q.trim().length >= 2 && results.length === 0, [loading, q, results]);

  return (
    <div className="p-4">
      <div className="relative mb-4">
        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم المستخدم..."
          className="pr-9"
          autoFocus
        />
      </div>

      {q.trim().length > 0 && q.trim().length < 2 && (
        <p className="text-center text-xs text-muted-foreground font-typewriter py-2">اكتب حرفين على الأقل</p>
      )}

      {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

      {empty && <p className="text-center text-muted-foreground font-typewriter py-8">لا توجد نتائج</p>}

      <ul className="space-y-2">
        {results.map((u) => {
          const entry = statuses.get(u.user_id) ?? { status: "none" as FriendshipStatus };
          const isBusy = busy === u.user_id;
          return (
            <li key={u.user_id} className="flex items-center gap-3 card-horror p-3">
              <Link to={`/chat/u/${u.username}`} className="flex items-center gap-3 flex-1 min-w-0">
                <UserAvatar url={u.avatar_url} username={u.username} />
                <div className="flex-1 min-w-0">
                  <div className="font-horror text-primary truncate">{u.username}</div>
                  <div className="text-xs text-muted-foreground font-typewriter">{u.riddles_completed} لغز</div>
                </div>
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                {entry.status === "friends" && (
                  <Link to={`/chat/u/${u.username}`} className="inline-flex items-center gap-1 text-xs text-primary border border-primary/40 rounded-md px-2 py-1">
                    <MessageCircle className="w-3.5 h-3.5" /> رسالة
                  </Link>
                )}
                {entry.status === "none" && (
                  <Button size="sm" disabled={isBusy} onClick={() => handleSend(u.user_id)}>
                    {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><UserPlus className="w-3.5 h-3.5 mr-1" /> إضافة</>}
                  </Button>
                )}
                {entry.status === "outgoing" && (
                  <Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleCancel(u.user_id, entry.requestId)}>
                    إلغاء الطلب
                  </Button>
                )}
                {entry.status === "incoming" && (
                  <>
                    <Button size="sm" disabled={isBusy} onClick={() => handleRespond(u.user_id, entry.requestId, true)}>
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" disabled={isBusy} onClick={() => handleRespond(u.user_id, entry.requestId, false)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}
                {entry.status === "blocked" && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Ban className="w-3.5 h-3.5" /> محظور
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
