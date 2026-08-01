// استعلامات الحالة/الستوري — نفس مبدأ الوسائط المؤقتة المشفّرة، لكن
// بمهلة صلاحية 24 ساعة بالضبط من وقت النشر (بيتحسب تلقائيًا في
// الداتابيز default (now() + interval '24 hours')، ومفيش داعي نبعته
// من العميل). الحذف التلقائي بعد انتهاء المهلة بيتم عبر Cron Job
// (purge_expired_stories) في migration الستوري.

import { supabase } from "@/integrations/supabase/client";
import { encryptFile, decryptToBlob, detectMediaKind } from "./mediaCrypto";
import type { PublicProfile } from "./queries";

const BUCKET = "ephemeral-media";

export type Story = {
  id: string;
  user_id: string;
  kind: "text" | "image" | "video";
  text_content: string | null;
  media_path: string | null;
  media_mime: string | null;
  media_iv: string | null;
  media_key: string | null;
  background_color: string | null;
  created_at: string;
  expires_at: string;
};

export type StoryGroup = {
  user: PublicProfile;
  stories: Story[];
  allViewed: boolean;
};

/** إنشاء ستوري نصي بخلفية لونية (زي واتساب) */
export async function createTextStory(userId: string, text: string, backgroundColor: string) {
  const cleaned = text.trim();
  if (!cleaned) throw new Error("اكتب نص الستوري");
  const { error } = await supabase.from("stories").insert({
    user_id: userId,
    kind: "text",
    text_content: cleaned,
    background_color: backgroundColor,
  } as any);
  if (error) throw error;
}

/** إنشاء ستوري صورة/فيديو — مشفّر على الجهاز قبل الرفع، زي رسائل الوسائط بالظبط */
export async function createMediaStory(userId: string, file: File, mime: string) {
  const kind = detectMediaKind(mime);
  if (kind !== "image" && kind !== "video") throw new Error("نوع ملف غير مدعوم للستوري");

  const { ciphertext, ivBase64, keyBase64 } = await encryptFile(file);
  const path = `stories/${userId}/${crypto.randomUUID()}.enc`;
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, ciphertext, {
    contentType: "application/octet-stream",
    upsert: false,
  });
  if (upErr) throw new Error(upErr.message || "تعذر رفع الستوري");

  const { error } = await supabase.from("stories").insert({
    user_id: userId,
    kind,
    media_path: path,
    media_mime: mime,
    media_iv: ivBase64,
    media_key: keyBase64,
  } as any);
  if (error) throw error;
}

/** يفك تشفير وسائط ستوري ويرجع Object URL جاهز للعرض */
export async function decryptStoryMediaUrl(story: Story): Promise<string> {
  if (!story.media_path || !story.media_iv || !story.media_key || !story.media_mime) {
    throw new Error("ستوري بدون وسائط");
  }
  const { data, error } = await supabase.storage.from(BUCKET).download(story.media_path);
  if (error || !data) throw new Error("تعذر تحميل الستوري (ممكن تكون انتهت)");
  const blob = await decryptToBlob(data, story.media_iv, story.media_key, story.media_mime);
  return URL.createObjectURL(blob);
}

/** ستوريهات الأصدقاء (والمستخدم نفسه) السارية حاليًا، مجمّعة لكل مستخدم */
export async function fetchActiveStoryGroups(
  myId: string,
  friendProfiles: PublicProfile[]
): Promise<StoryGroup[]> {
  const userIds = Array.from(new Set([myId, ...friendProfiles.map((f) => f.user_id)]));
  const { data: stories, error } = await supabase
    .from("stories")
    .select("*")
    .in("user_id", userIds)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });
  if (error) throw error;

  const { data: myViews } = await supabase.from("story_views").select("story_id").eq("viewer_id", myId);
  const viewedIds = new Set((myViews ?? []).map((v: any) => v.story_id));

  const byUser = new Map<string, Story[]>();
  for (const s of (stories ?? []) as Story[]) {
    if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
    byUser.get(s.user_id)!.push(s);
  }

  const profilesById = new Map<string, PublicProfile>(friendProfiles.map((f) => [f.user_id, f]));

  const groups: StoryGroup[] = [];
  for (const [userId, list] of byUser.entries()) {
    const profile = userId === myId ? null : profilesById.get(userId);
    if (userId !== myId && !profile) continue; // مش صديق فعلي (احتياط)
    groups.push({
      user: profile ?? ({ user_id: myId } as PublicProfile),
      stories: list,
      allViewed: list.every((s) => viewedIds.has(s.id)),
    });
  }

  // ستوري نفسي يفضل أول واحد دايمًا
  groups.sort((a, b) => (a.user.user_id === myId ? -1 : b.user.user_id === myId ? 1 : 0));
  return groups;
}

export async function markStoryViewed(storyId: string, viewerId: string) {
  await supabase.from("story_views").upsert(
    { story_id: storyId, viewer_id: viewerId },
    { onConflict: "story_id,viewer_id" }
  );
}

/** قائمة مشاهدي ستوري معين — تظهر بس لصاحب الستوري */
export async function fetchStoryViewers(storyId: string) {
  const { data } = await supabase
    .from("story_views")
    .select("viewer_id, viewed_at")
    .eq("story_id", storyId)
    .order("viewed_at", { ascending: false });
  return data ?? [];
}

export async function deleteStory(storyId: string) {
  const { error } = await supabase.from("stories").delete().eq("id", storyId);
  if (error) throw error;
}
