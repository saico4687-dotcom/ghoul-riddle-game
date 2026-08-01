import { supabase } from "@/integrations/supabase/client";

// ============================================================
// أنواع البيانات (Types) — مطابقة لأعمدة الجداول الفعلية على
// Supabase (groups, group_members, group_messages, group_polls,
// group_poll_options, group_poll_votes)
// ============================================================

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
  last_message_at: string | null;
  last_message_preview: string | null;
  pinned_message_id: string | null;
  pinned_by: string | null;
  pinned_at: string | null;
  pinned_until: string | null;
  // مدة اختفاء الرسائل تلقائياً بالثواني — null يعني متوقفة
  disappearing_seconds: number | null;
  max_members: number;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: "owner" | "admin" | "member";
  status: "active" | "banned" | "left";
  joined_at: string;
  // أرشفة/تثبيت الجروب في القائمة بالنسبة لهذا العضو بس (محلي لكل عضو)
  archived: boolean;
  pinned: boolean;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
  deleted_at: string | null;
  system_event: "joined" | "left" | "banned" | null;
  reply_to_id: string | null;
  read_at: string | null;
  edited_at: string | null;
  // قائمة الـ user_id اللي عملوا "حذف من عندي" للرسالة دي
  deleted_for: string[];
  media_path: string | null;
  media_type: "image" | "audio" | "video" | null;
  media_mime: string | null;
  media_size_bytes: number | null;
  media_duration_seconds: number | null;
  media_iv: string | null;
  media_key: string | null;
  media_expires_at: string | null;
  media_deleted_at: string | null;
  // وقت الاختفاء التلقائي (Disappearing Messages)
  expires_at: string | null;
  view_once: boolean;
  viewed_at: string | null;
  location_lat: number | null;
  location_lng: number | null;
  location_label: string | null;
  live_location_until: string | null;
};

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

// ============================================================
// جلب الجروبات والرسائل
// ============================================================

export async function fetchMyGroups(myId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("role, archived, pinned, groups(*)")
    .eq("user_id", myId)
    .eq("status", "active");
  if (error) throw error;

  return (data ?? [])
    .filter((row: any) => row.groups)
    .map((row: any) => ({
      ...(row.groups as Group),
      myRole: row.role as "owner" | "admin" | "member",
      archived: row.archived as boolean,
      pinned: row.pinned as boolean,
    }));
}

export async function fetchGroup(groupId: string) {
  const { data, error } = await supabase.from("groups").select("*").eq("id", groupId).maybeSingle();
  if (error) throw error;
  return data as Group | null;
}

export async function fetchGroupMembers(groupId: string) {
  const { data, error } = await supabase.from("group_members").select("*").eq("group_id", groupId);
  if (error) throw error;
  return (data ?? []) as GroupMember[];
}

export async function fetchGroupMessages(groupId: string) {
  const { data, error } = await supabase
    .from("group_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as GroupMessage[];
}

export async function fetchMyMembership(groupId: string, userId: string) {
  const { data, error } = await supabase
    .from("group_members")
    .select("*")
    .eq("group_id", groupId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data as GroupMember | null;
}

// ============================================================
// إنشاء/الانضمام/مغادرة/حذف الجروب
// ============================================================

export async function createGroup(input: { name: string; description?: string | null; avatarUrl?: string | null }) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("يجب تسجيل الدخول");

  const name = input.name.trim();
  if (!name) throw new Error("اسم الجروب مطلوب");

  // owner_id بيتضاف تلقائياً كعضو "owner" عبر تريجر on_group_created
  const { data, error } = await supabase
    .from("groups")
    .insert({
      name,
      description: input.description?.trim() || null,
      avatar_url: input.avatarUrl || null,
      owner_id: u.user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as Group;
}

export async function joinGroupByInvite(inviteCode: string) {
  const { data, error } = await supabase.rpc("join_group_by_invite", { _invite_code: inviteCode });
  if (error) throw new Error(error.message || "رابط الدعوة غير صالح");
  return data as string;
}

export async function leaveGroup(groupId: string) {
  const { error } = await supabase.rpc("leave_group", { _group_id: groupId });
  if (error) throw error;
}

export async function deleteGroup(groupId: string) {
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw error;
}

export async function updateGroup(
  groupId: string,
  patch: Partial<Pick<Group, "name" | "description" | "avatar_url" | "lock_chat" | "disappearing_seconds" | "invite_enabled">>
) {
  const { error } = await supabase.from("groups").update(patch as any).eq("id", groupId);
  if (error) throw error;
}

export async function regenerateGroupInvite(groupId: string) {
  const { data, error } = await supabase.rpc("regenerate_group_invite", { _group_id: groupId });
  if (error) throw error;
  return data as string;
}

// ============================================================
// إدارة الأعضاء (أدوار/حظر/إزالة)
// ============================================================

export async function setGroupAdmin(groupId: string, targetUser: string, makeAdmin: boolean) {
  const { error } = await supabase.rpc("set_group_admin", {
    _group_id: groupId,
    _target_user: targetUser,
    _make_admin: makeAdmin,
  });
  if (error) throw error;
}

export async function banGroupMember(groupId: string, targetUser: string, reason?: string | null) {
  const { error } = await supabase.rpc("ban_group_member", {
    _group_id: groupId,
    _target_user: targetUser,
    _reason: reason ?? null,
  });
  if (error) throw error;
}

export async function unbanGroupMember(groupId: string, targetUser: string) {
  const { error } = await supabase.rpc("unban_group_member", { _group_id: groupId, _target_user: targetUser });
  if (error) throw error;
}

export async function removeGroupMember(groupId: string, targetUser: string) {
  const { error } = await supabase.rpc("remove_group_member", { _group_id: groupId, _target_user: targetUser });
  if (error) throw error;
}

// أرشفة/تثبيت الجروب في قائمتي أنا بس (عمودين محليين في group_members)
export async function toggleGroupArchived(groupId: string, myId: string, currentArchived: boolean) {
  const next = !currentArchived;
  const { error } = await supabase
    .from("group_members")
    .update({ archived: next })
    .eq("group_id", groupId)
    .eq("user_id", myId);
  if (error) throw error;
  return next;
}

export async function toggleGroupPinned(groupId: string, myId: string, currentPinned: boolean) {
  const next = !currentPinned;
  const { error } = await supabase
    .from("group_members")
    .update({ pinned: next })
    .eq("group_id", groupId)
    .eq("user_id", myId);
  if (error) throw error;
  return next;
}

// ============================================================
// إرسال/تعديل/حذف رسائل الجروب
// ============================================================

export async function sendGroupMessage(groupId: string, senderId: string, body: string, replyToId?: string | null) {
  const cleaned = body.trim();
  if (!cleaned) throw new Error("رسالة فارغة");
  const { data, error } = await supabase
    .from("group_messages")
    .insert({ group_id: groupId, sender_id: senderId, body: cleaned, reply_to_id: replyToId ?? null })
    .select()
    .single();
  if (error) throw error;
  return data as GroupMessage;
}

/** تعديل رسالة جروب — مسموح للمرسل بس خلال 15 دقيقة (يتحقق منها الـ RPC نفسه في الداتابيز) */
export async function editGroupMessage(messageId: string, newBody: string) {
  const { error } = await supabase.rpc("edit_group_message", { _message_id: messageId, _new_body: newBody });
  if (error) throw new Error(error.message || "تعذر تعديل الرسالة");
}

/** حذف من عندي فقط — الرسالة تفضل ظاهرة لباقي أعضاء الجروب */
export async function deleteGroupMessageForMe(messageId: string, myId: string) {
  const { data: current, error: fetchErr } = await supabase
    .from("group_messages")
    .select("deleted_for")
    .eq("id", messageId)
    .single();
  if (fetchErr) throw fetchErr;
  const next = Array.from(new Set([...(current?.deleted_for ?? []), myId]));
  const { error } = await supabase.from("group_messages").update({ deleted_for: next }).eq("id", messageId);
  if (error) throw error;
}

/** حذف للجميع — مسموح للمرسل أو المشرفين، وخلال 60 ساعة من الإرسال للمرسل العادي */
export async function softDeleteGroupMessage(messageId: string) {
  const { error } = await supabase
    .from("group_messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", messageId);
  if (error) throw error;
}

export async function markGroupRead(groupId: string) {
  await supabase.rpc("mark_group_read", { _group_id: groupId });
}

export async function fetchUnreadCountsByGroup() {
  const { data, error } = await supabase.rpc("get_my_group_unread_counts");
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { group_id: string; unread_count: number }[]) {
    counts.set(row.group_id, Number(row.unread_count));
  }
  return counts;
}

// خيارات الرسائل المؤقتة الشائعة (زي واتساب): إيقاف / 24 ساعة / 7 أيام / 90 يوم
export const DISAPPEARING_OPTIONS: { label: string; seconds: number | null }[] = [
  { label: "إيقاف", seconds: null },
  { label: "24 ساعة", seconds: 24 * 60 * 60 },
  { label: "7 أيام", seconds: 7 * 24 * 60 * 60 },
  { label: "90 يوم", seconds: 90 * 24 * 60 * 60 },
];

// بتشيل من قائمة رسائل محمّلة أي رسالة اتخطى معاد انتهائها من الواجهة فقط
export function dropExpired<T extends { expires_at?: string | null }>(list: T[]): T[] {
  const now = Date.now();
  return list.filter((m) => !m.expires_at || new Date(m.expires_at).getTime() > now);
}

// ============================================================
// منشن @username
// ============================================================

export function extractMentionedUserIds(
  text: string,
  candidates: { user_id: string; username: string | null }[]
): string[] {
  const matches = Array.from(text.matchAll(/(?:^|\s)@([A-Za-z0-9_\u0600-\u06FF]+)/g)).map((m) => m[1].toLowerCase());
  if (matches.length === 0) return [];
  const set = new Set(matches);
  return candidates.filter((c) => c.username && set.has(c.username.toLowerCase())).map((c) => c.user_id);
}

export async function insertGroupMessageMentions(messageId: string, mentionedUserIds: string[]) {
  if (mentionedUserIds.length === 0) return;
  const rows = mentionedUserIds.map((uid) => ({ group_message_id: messageId, mentioned_user_id: uid }));
  const { error } = await supabase.from("message_mentions").insert(rows);
  if (error) throw error;
}

// ============================================================
// استطلاعات الرأي (Polls)
// ============================================================

export async function createGroupPoll(
  groupId: string,
  creatorId: string,
  question: string,
  options: string[],
  allowMultiple: boolean
) {
  const cleanQuestion = question.trim();
  const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
  if (!cleanQuestion) throw new Error("سؤال الاستطلاع فارغ");
  if (cleanOptions.length < 2) throw new Error("لازم خيارين على الأقل");

  const { data: message, error: msgError } = await supabase
    .from("group_messages")
    .insert({ group_id: groupId, sender_id: creatorId, body: null })
    .select()
    .single();
  if (msgError) throw msgError;

  const { data: poll, error: pollError } = await supabase
    .from("group_polls")
    .insert({
      group_id: groupId,
      message_id: message.id,
      creator_id: creatorId,
      question: cleanQuestion,
      allow_multiple: allowMultiple,
    })
    .select()
    .single();
  if (pollError) throw pollError;

  const { data: insertedOptions, error: optError } = await supabase
    .from("group_poll_options")
    .insert(cleanOptions.map((text, i) => ({ poll_id: poll.id, option_text: text, position: i })))
    .select();
  if (optError) throw optError;

  return {
    message: message as GroupMessage,
    poll: poll as GroupPoll,
    options: (insertedOptions ?? []) as GroupPollOption[],
  };
}

export async function fetchGroupPolls(groupId: string) {
  const { data: polls, error: pollsErr } = await supabase.from("group_polls").select("*").eq("group_id", groupId);
  if (pollsErr) throw pollsErr;

  const pollIds = (polls ?? []).map((p) => p.id);
  if (pollIds.length === 0) {
    return { polls: [] as GroupPoll[], options: [] as GroupPollOption[], votes: [] as GroupPollVote[] };
  }

  const [{ data: options, error: optErr }, { data: votes, error: voteErr }] = await Promise.all([
    supabase.from("group_poll_options").select("*").in("poll_id", pollIds),
    supabase.from("group_poll_votes").select("*").in("poll_id", pollIds),
  ]);
  if (optErr) throw optErr;
  if (voteErr) throw voteErr;

  return {
    polls: (polls ?? []) as GroupPoll[],
    options: (options ?? []) as GroupPollOption[],
    votes: (votes ?? []) as GroupPollVote[],
  };
}

/** تصويت — لو ضغط على نفس الخيار تاني بيتشال (إلغاء تصويت)، ولو الاستطلاع مش
 *  متعدد الاختيارات بيتشال أي تصويت سابق ليه قبل ما يضيف الجديد */
export async function voteOnPoll(pollId: string, optionId: string, userId: string, allowMultiple: boolean) {
  const { data: existing, error: existingErr } = await supabase
    .from("group_poll_votes")
    .select("option_id")
    .eq("poll_id", pollId)
    .eq("user_id", userId);
  if (existingErr) throw existingErr;

  const alreadyVotedThis = (existing ?? []).some((v) => v.option_id === optionId);
  if (alreadyVotedThis) {
    const { error } = await supabase
      .from("group_poll_votes")
      .delete()
      .eq("poll_id", pollId)
      .eq("option_id", optionId)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  if (!allowMultiple && (existing ?? []).length > 0) {
    const { error: delErr } = await supabase
      .from("group_poll_votes")
      .delete()
      .eq("poll_id", pollId)
      .eq("user_id", userId);
    if (delErr) throw delErr;
  }

  const { error } = await supabase.from("group_poll_votes").insert({ poll_id: pollId, option_id: optionId, user_id: userId });
  if (error) throw error;
}

// ============================================================
// تثبيت رسالة في الجروب (Pin) — بمدة اختيارية
// ============================================================

// القيم مطابقة تماماً لما بيتحقق منه RPC "pin_group_message" في الداتابيز
export const PIN_DURATION_OPTIONS: { label: string; hours: number | null }[] = [
  { label: "24 ساعة", hours: 24 },
  { label: "7 أيام", hours: 168 },
  { label: "30 يوم", hours: 720 },
  { label: "بدون مهلة", hours: null },
];

export async function pinGroupMessage(groupId: string, messageId: string, hours: number | null) {
  const { error } = await supabase.rpc("pin_group_message", {
    _group_id: groupId,
    _message_id: messageId,
    _duration_hours: hours,
  });
  if (error) throw new Error(error.message || "تعذر تثبيت الرسالة");
}

export async function unpinGroupMessage(groupId: string) {
  const { error } = await supabase.rpc("unpin_group_message", { _group_id: groupId });
  if (error) throw new Error(error.message || "تعذر إلغاء التثبيت");
}

export function isPinActive(group: Pick<Group, "pinned_message_id" | "pinned_until">) {
  if (!group.pinned_message_id) return false;
  if (!group.pinned_until) return true;
  return new Date(group.pinned_until).getTime() > Date.now();
}

// ============================================================
// الإبلاغ عن محتوى/عضو داخل جروب
// ============================================================

export async function reportGroupContent(opts: {
  reporterId: string;
  groupId: string;
  targetUserId?: string;
  targetMessageId?: string;
  reason: string;
  category: string;
}) {
  const { error } = await supabase.from("group_reports").insert({
    reporter_id: opts.reporterId,
    group_id: opts.groupId,
    target_user_id: opts.targetUserId ?? null,
    target_message_id: opts.targetMessageId ?? null,
    reason: opts.reason,
    category: opts.category,
  });
  if (error) throw error;
}
