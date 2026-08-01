import { supabase } from "@/integrations/supabase/client";
import { ensureFreshSession, SESSION_EXPIRED_MESSAGE } from "@/lib/ensureSession";

export type GroupRole = "owner" | "admin" | "member";
export type GroupMemberStatus = "active" | "banned" | "left";

export type Group = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  owner_id: string;
  lock_chat: boolean;
  invite_code: string;
  invite_enabled: boolean;
  created_at: string;
  updated_at: string;
  // مدة اختفاء الرسائل تلقائياً بالثواني (24 ساعة/7 أيام/90 يوم) — null يعني متوقفة
  disappearing_seconds?: number | null;
  // بتتحدث تلقائيًا من trigger on_group_message_inserted لما تتبعت رسالة جديدة
  last_message_at?: string | null;
  last_message_preview?: string | null;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: GroupRole;
  status: GroupMemberStatus;
  joined_at: string;
};

export type GroupSystemEvent = "joined" | "left" | "banned" | "removed";

export type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
  deleted_at: string | null;
  // وقت آخر تعديل لنص رسالة الجروب (خلال 15 دقيقة من الإرسال، ينفَّذ التريجر في الداتابيز)
  edited_at: string | null;
  // قائمة الـ user_id اللي عملوا "حذف من عندي" لرسالة الجروب دي
  deleted_for: string[];
  // وقت الاختفاء التلقائي للرسالة (بيتحسب في الداتابيز وقت الإدراج حسب
  // إعداد groups.disappearing_seconds). null يعني الرسالة مش هتختفي.
  expires_at?: string | null;
  // بتتحدد تلقائياً من الداتابيز (join_group_by_invite / leave_group /
  // ban_group_member / remove_group_member) — لو موجودة يبقى الرسالة دي
  // رسالة نظام (انضم/غادر/حُظر/اتشال) مش رسالة عادية من اليوزر
  system_event?: GroupSystemEvent | null;
  // معرّف رسالة الجروب اللي حصل عليها "رد" — بيتحط لما اليوزر يسحب/يشد
  // رسالة في شات الجروب ويكتب تحتها زي واتساب. null لو مش رد.
  reply_to_id: string | null;
  // وسائط مؤقتة مشفّرة (صورة/فيديو/صوت) — نفس آلية الرسائل الفردية.
  // المفتاح والـ IV بيتمسحوا من الصف نفسه أول ما الملف يتمسح من الـ
  // storage (استلام أو انتهاء 72 ساعة)، فـ media_deleted_at != null
  // معناها الوسائط خلصت ومفيش داعي نحاول نفك تشفيرها.
  media_path: string | null;
  media_type: "image" | "audio" | "video" | null;
  media_mime: string | null;
  media_size_bytes: number | null;
  media_duration_seconds: number | null;
  media_iv: string | null;
  media_key: string | null;
  media_expires_at: string | null;
  media_deleted_at: string | null;
};

// ---------- Groups ----------

export async function createGroup(input: { name: string; description?: string | null; avatarUrl?: string | null }) {
  const sessionOk = await ensureFreshSession();
  if (!sessionOk) throw new Error(SESSION_EXPIRED_MESSAGE);

  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("يجب تسجيل الدخول");

  const { data, error } = await supabase
    .from("groups")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      avatar_url: input.avatarUrl ?? null,
      owner_id: u.user.id,
    })
    .select()
    .single();

  if (error) throw new Error(error.message || "تعذر إنشاء الجروب");
  return data as Group;
}

export async function fetchMyGroups(myId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("group_id, role, status, groups(*)")
    .eq("user_id", myId)
    .eq("status", "active");
  if (error) throw error;
  return (data ?? [])
    .map((row: any) => ({ ...(row.groups as Group), myRole: row.role as GroupRole }))
    .filter((g: any) => !!g.id);
}

export async function fetchGroup(groupId: string) {
  const { data, error } = await supabase.from("groups").select("*").eq("id", groupId).maybeSingle();
  if (error) throw error;
  return data as Group | null;
}

export async function updateGroup(groupId: string, patch: Partial<Pick<Group, "name" | "description" | "avatar_url" | "lock_chat" | "invite_enabled" | "disappearing_seconds">>) {
  const { error } = await supabase.from("groups").update(patch).eq("id", groupId);
  if (error) throw new Error(error.message || "تعذر تحديث الجروب");
}

// خيارات الرسائل المؤقتة الشائعة (زي واتساب): إيقاف / 24 ساعة / 7 أيام / 90 يوم
export const DISAPPEARING_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: "إيقاف", seconds: null },
  { label: "24 ساعة", seconds: 24 * 60 * 60 },
  { label: "7 أيام", seconds: 7 * 24 * 60 * 60 },
  { label: "90 يوم", seconds: 90 * 24 * 60 * 60 },
];

// بتشيل من قائمة رسائل محمّلة أي رسالة اتخطى معاد انتهائها (Disappearing) —
// الحذف الفعلي من الداتابيز محتاج Cron/Edge Function منفصلة، لكن ده كافي
// عشان المستخدم ميشوفهاش في الواجهة أول ما تنتهي مدتها.
export function dropExpired<T extends { expires_at?: string | null }>(list: T[]): T[] {
  const now = Date.now();
  return list.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now);
}

export async function deleteGroup(groupId: string) {
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw new Error(error.message || "تعذر حذف الجروب");
}

// عدد الرسايل الغير مقروءة لكل جروب على حدة — بيستخدم الـ RPC الجاهزة
// على الداتابيز (get_my_group_unread_counts) اللي بتحسب من عمود
// group_messages.read_at، مش من جدول notifications
export async function fetchUnreadCountsByGroup() {
  const { data, error } = await supabase.rpc("get_my_group_unread_counts");
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { group_id: string; unread_count: number }[]) {
    counts.set(row.group_id, Number(row.unread_count));
  }
  return counts;
}

// بتتنادى لما المستخدم يفتح شات جروب، عشان تصفّر شارة الجروب ده بس
// (بتنادي RPC الجاهزة mark_group_read)
export async function markGroupRead(groupId: string) {
  const { error } = await supabase.rpc("mark_group_read", { _group_id: groupId });
  if (error) console.error("[markGroupRead]", error);
}

// ---------- Members ----------

export async function fetchGroupMembers(groupId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

export async function fetchMyMembership(groupId: string, myId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .eq("user_id", myId)
    .maybeSingle();
  if (error) throw error;
  return data as GroupMember | null;
}

export async function joinGroupByInvite(inviteCode: string) {
  const { data, error } = await supabase.rpc("join_group_by_invite", { _invite_code: inviteCode.trim() });
  if (error) throw new Error(error.message || "رابط الدعوة غير صالح");
  return data as string; // group_id
}

export async function regenerateGroupInvite(groupId: string) {
  const { data, error } = await supabase.rpc("regenerate_group_invite", { _group_id: groupId });
  if (error) throw new Error(error.message || "تعذر تجديد رابط الدعوة");
  return data as string; // new invite_code
}

export async function setGroupAdmin(groupId: string, targetUser: string, makeAdmin: boolean) {
  const { error } = await supabase.rpc("set_group_admin", { _group_id: groupId, _target_user: targetUser, _make_admin: makeAdmin });
  if (error) throw new Error(error.message || "تعذر تغيير صلاحية العضو");
}

export async function banGroupMember(groupId: string, targetUser: string, reason?: string) {
  const { error } = await supabase.rpc("ban_group_member", { _group_id: groupId, _target_user: targetUser, _reason: reason ?? null });
  if (error) throw new Error(error.message || "تعذر حظر العضو");
}

export async function unbanGroupMember(groupId: string, targetUser: string) {
  const { error } = await supabase.rpc("unban_group_member", { _group_id: groupId, _target_user: targetUser });
  if (error) throw new Error(error.message || "تعذر فك الحظر");
}

export async function removeGroupMember(groupId: string, targetUser: string) {
  const { error } = await supabase.rpc("remove_group_member", { _group_id: groupId, _target_user: targetUser });
  if (error) throw new Error(error.message || "تعذر إزالة العضو");
}

export async function leaveGroup(groupId: string) {
  const { error } = await supabase.rpc("leave_group", { _group_id: groupId });
  if (error) throw new Error(error.message || "تعذر مغادرة الجروب");
}

// ---------- Messages ----------

export async function fetchGroupMessages(groupId: string, limit = 50) {
  const { data, error } = await supabase
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as GroupMessage[]).reverse();
}

export async function sendGroupMessage(
  groupId: string,
  senderId: string,
  body?: string | null,
  imageUrl?: string | null,
  replyToId?: string | null
) {
  const { filterMessage } = await import("./contentFilter");
  const cleanBody = body?.trim() ? filterMessage(body.trim()) : null;
  const { data, error } = await supabase
    .from("group_messages")
    .insert({
      group_id: groupId,
      sender_id: senderId,
      body: cleanBody,
      image_url: imageUrl ?? null,
      reply_to_id: replyToId ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message || "تعذر إرسال الرسالة");
  return data as GroupMessage;
}

/** تعديل نص رسالة جروب — مسموح للمرسل بس، وخلال 15 دقيقة من الإرسال */
export async function editGroupMessage(messageId: string, newBody: string) {
  const { error } = await supabase.from("group_messages").update({ body: newBody }).eq("id", messageId);
  if (error) throw new Error(error.message || "تعذر تعديل الرسالة");
}

/** حذف من عندي فقط في شات الجروب — الرسالة تفضل ظاهرة للباقين */
export async function deleteGroupMessageForMe(messageId: string, myId: string) {
  const { data: current, error: fetchErr } = await supabase
    .from("group_messages")
    .select("deleted_for")
    .eq("id", messageId)
    .single();
  if (fetchErr) throw new Error(fetchErr.message || "تعذر حذف الرسالة");
  const next = Array.from(new Set([...(current?.deleted_for ?? []), myId]));
  const { error } = await supabase.from("group_messages").update({ deleted_for: next }).eq("id", messageId);
  if (error) throw new Error(error.message || "تعذر حذف الرسالة");
}

export async function softDeleteGroupMessage(messageId: string) {
  const { error } = await supabase.from("group_messages").update({ deleted_at: new Date().toISOString() }).eq("id", messageId);
  if (error) throw new Error(error.message || "تعذر حذف الرسالة");
}

// ---------- Mentions (@username) ----------

// بيدور في نص الرسالة على @username ويرجّع الـ user_id بتوعهم، بمقارنة
// كل منشن بقائمة أعضاء الجروب النشطين اللي عندنا في الواجهة أصلاً — بدون
// أي نداء إضافي للسيرفر.
export function extractMentionedUserIds(
  body: string,
  members: { user_id: string; username: string | null }[]
): string[] {
  const matches = Array.from(body.matchAll(/@([A-Za-z0-9_\u0600-\u06FF]+)/g)).map((m) => m[1].toLowerCase());
  if (matches.length === 0) return [];
  const found = new Set<string>();
  for (const mem of members) {
    if (mem.username && matches.includes(mem.username.toLowerCase())) found.add(mem.user_id);
  }
  return Array.from(found);
}

export async function insertGroupMessageMentions(groupMessageId: string, mentionedUserIds: string[]) {
  if (mentionedUserIds.length === 0) return;
  const rows = mentionedUserIds.map((uid) => ({ group_message_id: groupMessageId, mentioned_user_id: uid }));
  const { error } = await supabase.from("message_mentions").insert(rows);
  if (error) console.error("[insertGroupMessageMentions]", error);
}

// ---------- Polls ----------

export type GroupPoll = {
  id: string;
  group_id: string;
  message_id: string | null;
  creator_id: string;
  question: string;
  allow_multiple: boolean;
  closed_at: string | null;
  created_at: string;
};

export type GroupPollOption = {
  id: string;
  poll_id: string;
  option_text: string;
  position: number;
};

export type GroupPollVote = {
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
};

// بيعمل رسالة (marker) في شات الجروب الأول عشان تاخد ترتيبها الزمني
// الطبيعي جوه الرسائل، بعدين يربط الاستطلاع بيها عن طريق message_id —
// نفس فكرة إن الاستطلاع "رسالة" زي أي رسالة تانية.
export async function createGroupPoll(
  groupId: string,
  creatorId: string,
  question: string,
  options: string[],
  allowMultiple: boolean
) {
  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  if (question.trim().length < 2) throw new Error("اكتب سؤال الاستطلاع");
  if (cleanOptions.length < 2) throw new Error("لازم خيارين على الأقل");

  const message = await sendGroupMessage(groupId, creatorId, "📊 استطلاع رأي: " + question.trim());

  const { data: poll, error: pollErr } = await supabase
    .from("group_polls")
    .insert({
      group_id: groupId,
      message_id: message.id,
      creator_id: creatorId,
      question: question.trim(),
      allow_multiple: allowMultiple,
    })
    .select()
    .single();
  if (pollErr) throw new Error(pollErr.message || "تعذر إنشاء الاستطلاع");

  const { data: opts, error: optErr } = await supabase
    .from("group_poll_options")
    .insert(cleanOptions.map((text, i) => ({ poll_id: (poll as any).id, option_text: text, position: i })))
    .select();
  if (optErr) throw new Error(optErr.message || "تعذر إضافة خيارات الاستطلاع");

  return { message, poll: poll as GroupPoll, options: (opts ?? []) as GroupPollOption[] };
}

// بيجيب كل الاستطلاعات + خياراتها + أصواتها الخاصة بجروب معيّن، مجمّعين
// حسب message_id عشان نقدر نعرضهم مكان الرسالة بتاعتهم في قائمة الشات.
export async function fetchGroupPolls(groupId: string) {
  const { data: polls, error } = await supabase.from("group_polls").select("*").eq("group_id", groupId);
  if (error) throw error;
  const pollList = (polls ?? []) as GroupPoll[];
  if (pollList.length === 0) return { polls: [], options: [], votes: [] };

  const pollIds = pollList.map((p) => p.id);
  const [{ data: options }, { data: votes }] = await Promise.all([
    supabase.from("group_poll_options").select("*").in("poll_id", pollIds),
    supabase.from("group_poll_votes").select("*").in("poll_id", pollIds),
  ]);

  return {
    polls: pollList,
    options: (options ?? []) as GroupPollOption[],
    votes: (votes ?? []) as GroupPollVote[],
  };
}

export async function fetchPollVotes(pollId: string) {
  const { data, error } = await supabase.from("group_poll_votes").select("*").eq("poll_id", pollId);
  if (error) throw error;
  return (data ?? []) as GroupPollVote[];
}

// تصويت/سحب تصويت — لو الاستطلاع "اختيار واحد" (allow_multiple = false)
// بنمسح أي صوت سابق لنفس اليوزر جوه نفس الاستطلاع الأول.
export async function voteOnPoll(pollId: string, optionId: string, userId: string, allowMultiple: boolean) {
  const { data: existing } = await supabase
    .from("group_poll_votes")
    .select("option_id")
    .eq("poll_id", pollId)
    .eq("user_id", userId)
    .eq("option_id", optionId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("group_poll_votes")
      .delete()
      .eq("poll_id", pollId)
      .eq("user_id", userId)
      .eq("option_id", optionId);
    if (error) throw error;
    return;
  }

  if (!allowMultiple) {
    await supabase.from("group_poll_votes").delete().eq("poll_id", pollId).eq("user_id", userId);
  }
  const { error } = await supabase.from("group_poll_votes").insert({ poll_id: pollId, option_id: optionId, user_id: userId });
  if (error) throw new Error(error.message || "تعذر التصويت");
}

// ---------- Reports ----------

export async function reportGroupContent(input: {
  reporterId: string;
  groupId: string;
  targetUserId?: string | null;
  targetMessageId?: string | null;
  reason: string;
}) {
  const { error } = await supabase.from("group_reports").insert({
    reporter_id: input.reporterId,
    group_id: input.groupId,
    target_user_id: input.targetUserId ?? null,
    target_message_id: input.targetMessageId ?? null,
    reason: input.reason.trim(),
  });
  if (error) throw new Error(error.message || "تعذر إرسال البلاغ");
                             }
