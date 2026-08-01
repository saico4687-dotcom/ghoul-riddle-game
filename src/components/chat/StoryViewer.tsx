import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { X, Trash2, Eye } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchActiveStoryGroups,
  markStoryViewed,
  decryptStoryMediaUrl,
  deleteStory,
  fetchStoryViewers,
  type Story,
} from "@/lib/chat/storyQueries";
import { listFriends, fetchPublicProfilesByIds } from "@/lib/chat/queries";
import { toast } from "sonner";

const STORY_DURATION_MS = 5000;

export default function StoryViewer() {
  const { userId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stories, setStories] = useState<Story[]>([]);
  const [index, setIndex] = useState(0);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [viewerCount, setViewerCount] = useState<number | null>(null);

  const isMine = userId === user?.id;
  const current = stories[index];

  useEffect(() => {
    (async () => {
      if (!user || !userId) return;
      const fr = await listFriends(user.id);
      const friendProfiles = await fetchPublicProfilesByIds(fr.map((f: any) => f.friend_id));
      const groups = await fetchActiveStoryGroups(user.id, friendProfiles);
      const group = groups.find((g) => g.user.user_id === userId);
      if (!group || group.stories.length === 0) {
        toast.error("لا توجد ستوري سارية");
        navigate("/chat", { replace: true });
        return;
      }
      setStories(group.stories);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, user]);

  // فك التشفير/تجهيز المحتوى الحالي + تسجيل المشاهدة
  useEffect(() => {
    if (!current || !user) return;
    setMediaUrl(null);
    setProgress(0);
    setViewerCount(null);

    if (!isMine) markStoryViewed(current.id, user.id);
    if (isMine) fetchStoryViewers(current.id).then((v) => setViewerCount(v.length));

    let revoke: string | null = null;
    if (current.kind !== "text") {
      decryptStoryMediaUrl(current)
        .then((url) => {
          revoke = url;
          setMediaUrl(url);
        })
        .catch(() => {
          toast.error("تعذر تحميل هذه الستوري");
          goNext();
        });
    }
    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // شريط التقدم التلقائي
  useEffect(() => {
    if (!current) return;
    if (current.kind !== "text" && !mediaUrl) return; // استنى لحد ما الوسائط تفك تشفيرها
    const start = Date.now();
    const tick = setInterval(() => {
      const pct = Math.min(100, ((Date.now() - start) / STORY_DURATION_MS) * 100);
      setProgress(pct);
      if (pct >= 100) goNext();
    }, 50);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id, mediaUrl]);

  const goNext = () => {
    if (index < stories.length - 1) setIndex((i) => i + 1);
    else navigate("/chat", { replace: true });
  };
  const goPrev = () => {
    if (index > 0) setIndex((i) => i - 1);
  };

  const handleDelete = async () => {
    if (!current || !window.confirm("حذف هذه الستوري؟")) return;
    await deleteStory(current.id);
    goNext();
  };

  if (!current) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col" dir="rtl">
      <div className="flex gap-1 p-2 pt-3">
        {stories.map((s, i) => (
          <div key={s.id} className="flex-1 h-1 bg-white/30 rounded overflow-hidden">
            <div
              className="h-full bg-white"
              style={{ width: `${i < index ? 100 : i === index ? progress : 0}%` }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between px-3 py-1 text-white">
        <span className="text-sm font-typewriter">
          {new Date(current.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
        </span>
        <div className="flex items-center gap-3">
          {isMine && (
            <button onClick={handleDelete}>
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button onClick={() => navigate("/chat", { replace: true })}>
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      <div className="flex-1 relative flex items-center justify-center">
        {/* مناطق لمس للتنقل يمين/شمال */}
        <button className="absolute inset-y-0 right-0 w-1/3 z-10" onClick={goPrev} />
        <button className="absolute inset-y-0 left-0 w-1/3 z-10" onClick={goNext} />

        {current.kind === "text" ? (
          <div
            className="w-full h-full flex items-center justify-center p-8 text-center text-white text-2xl font-bold"
            style={{ backgroundColor: current.background_color ?? "#1e293b" }}
          >
            {current.text_content}
          </div>
        ) : mediaUrl ? (
          current.kind === "image" ? (
            <img src={mediaUrl} className="max-h-full max-w-full object-contain" alt="" />
          ) : (
            <video src={mediaUrl} className="max-h-full max-w-full" autoPlay playsInline />
          )
        ) : (
          <div className="text-white/60 text-sm font-typewriter">جاري التحميل...</div>
        )}
      </div>

      {isMine && viewerCount !== null && (
        <div className="flex items-center gap-2 text-white/80 px-4 py-3 text-sm font-typewriter">
          <Eye className="w-4 h-4" /> شاهدها {viewerCount}
        </div>
      )}
    </div>
  );
}
