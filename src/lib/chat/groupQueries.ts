import { supabase } from "@/integrations/supabase/client";

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
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: GroupRole;
  status: GroupMemberStatus;
  joined_at: string;
};

export type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string | null;
  image_url: string | null;
  created_at: string;
  deleted_at: string | null;
};

// ---------- Groups ----------

export async function createGroup(input: { name: string; description?: string | null; avatarUrl?: string | null }) {
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

export async function updateGroup(groupId: string, patch: Partial<Pick<Group, "name" | "description" | "avatar_url" | "lock_chat" | "invite_enabled">>) {
  const { error } = await supabase.from("groups").update(patch).eq("id", groupId);
  if (error) throw new Error(error.message || "تعذر تحديث الجروب");
}

export async function deleteGroup(groupId: string) {
  const { error } = await supabase.from("groups").delete().eq("id", groupId);
  if (error) throw new Error(error.message || "تعذر حذف الجروب");
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
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as GroupMessage[]).reverse();
}

export async function sendGroupMessage(groupId: string, senderId: string, body?: string | null, imageUrl?: string | null) {
  const { data, error } = await supabase
    .from("group_messages")
    .insert({ group_id: groupId, sender_id: senderId, body: body?.trim() || null, image_url: imageUrl ?? null })
    .select()
    .single();
  if (error) throw new Error(error.message || "تعذر إرسال الرسالة");
  return data as GroupMessage;
}

export async function softDeleteGroupMessage(messageId: string) {
  const { error } = await supabase.from("group_messages").update({ deleted_at: new Date().toISOString() }).eq("id", messageId);
  if (error) throw new Error(error.message || "تعذر حذف الرسالة");
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
