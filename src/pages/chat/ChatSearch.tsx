import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { searchUsers } from "@/lib/chat/queries";
import UserAvatar from "@/components/chat/UserAvatar";
import { Loader2, Search as SearchIcon } from "lucide-react";

export default function ChatSearch() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const r = await searchUsers(q);
      setResults(r);
      setLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="p-4">
      <div className="relative mb-4">
        <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث باسم المستخدم..."
          className="pr-9"
        />
      </div>

      {loading && <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}

      {!loading && q.length >= 2 && results.length === 0 && (
        <p className="text-center text-muted-foreground font-typewriter py-8">لا توجد نتائج</p>
      )}

      <ul className="space-y-2">
        {results.map((u) => (
          <li key={u.user_id}>
            <Link to={`/chat/u/${u.username}`} className="flex items-center gap-3 card-horror p-3 hover:border-primary/60">
              <UserAvatar url={u.avatar_url} username={u.username} />
              <div className="flex-1">
                <div className="font-horror text-primary">{u.username}</div>
                <div className="text-xs text-muted-foreground font-typewriter">{u.riddles_completed} لغز</div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
