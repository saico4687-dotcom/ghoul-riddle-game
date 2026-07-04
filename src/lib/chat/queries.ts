import { supabase } from "@/integrations/supabase/client";

export type PublicProfile = {
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  joined_at: string;
  riddles_completed: number;
  completed: boolean;
  last_seen_at: string | null;
  is_muted_until: string | null;
  is_suspended_until: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  deleted_at: string | null;
};

export type Conversation = {
  id: string;
  user_a: string;
  user_b: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
};

export type Reaction = {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type FriendRequest = {
  id: string;
  from_user: string;
  to_user: string;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  created_at: string;
};

export async function fetchMyProfile(userId: string) {
  const { data } = await supabase
    .from("profiles")
    .select("user_id, username, avatar_url, completed, last_puzzle_index, is_muted_until, is_suspended_until")
    .eq("user_id", userId)
    .maybeSingle();
  return data;
}

export async function fetchPublicProfile(userId: string) {
  const { data } = await (supabase as any)
    .from("public_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data ?? null) as PublicProfile | null;
}

export async function fetchPublicProfileByUsername(username: string) {
  const { data } = await (supabase as any)
    .from("public_profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  return (data ?? null) as PublicProfile | null;
}

export async function fetchPublicProfilesByIds(ids: string[]) {
  if (ids.length === 0) return [] as PublicProfile[];
  const { data } = await (supabase as any)
    .from("public_profiles")
    .select("*")
    .in("user_id", ids);
  return (data ?? []) as PublicProfile[];
}

export async function searchUsers(q: string) {
  if (!q.trim()) return [];
  const { data } = await supabase.rpc("search_users", { _q: q.trim() });
  return data ?? [];
}

export async function getOrCreateConversation(otherUserId: string) {
  const { data, error } = await supabase.rpc("get_or_create_conversation", { _other: otherUserId });
  if (error) throw error;
  return data as string;
}

export async function listMyConversations(myId: string) {
  const { data } = await supabase
    .from("conversations")
    .select("*")
    .or(`user_a.eq.${myId},user_b.eq.${myId}`)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(50);
  return (data ?? []) as Conversation[];
}

export async function listFriends(myId: string) {
  const { data } = await supabase
    .from("friends")
    .select("friend_id, created_at")
    .eq("user_id", myId);
  return data ?? [];
}

export async function listBlocked(myId: string) {
  const { data } = await supabase
    .from("blocked_users")
    .select("blocked_id, created_at")
    .eq("blocker_id", myId);
  return data ?? [];
}

export async function listIncomingRequests(myId: string) {
  const { data } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("to_user", myId)
    .eq("status", "pending");
  return (data ?? []) as FriendRequest[];
}

export async function listOutgoingRequests(myId: string) {
  const { data } = await supabase
    .from("friend_requests")
    .select("*")
    .eq("from_user", myId)
    .eq("status", "pending");
  return (data ?? []) as FriendRequest[];
}

export async function sendFriendRequest(toUser: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("not authenticated");
  const { error } = await supabase
    .from("friend_requests")
    .insert({ from_user: u.user.id, to_user: toUser });
  if (error) throw error;
}

export async function respondFriendRequest(requestId: string, accept: boolean) {
  const { error } = await supabase
    .from("friend_requests")
    .update({ status: accept ? "accepted" : "rejected" })
    .eq("id", requestId);
  if (error) throw error;
}

export async function removeFriend(myId: string, friendId: string) {
  await supabase.from("friends").delete().eq("user_id", myId).eq("friend_id", friendId);
  await supabase.from("friends").delete().eq("user_id", friendId).eq("friend_id", myId);
}

export async function blockUser(blockerId: string, blockedId: string) {
  const { error } = await supabase.from("blocked_users").insert({ blocker_id: blockerId, blocked_id: blockedId });
  if (error) throw error;
}

export async function unblockUser(blockerId: string, blockedId: string) {
  await supabase.from("blocked_users").delete().eq("blocker_id", blockerId).eq("blocked_id", blockedId);
}

export async function fetchMessages(conversationId: string, limit = 100) {
  const { data } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);
  return (data ?? []) as Message[];
}

export async function sendMessage(conversationId: string, senderId: string, body: string) {
  const { filterMessage, checkRateLimit } = await import("./contentFilter");
  const rl = checkRateLimit(conversationId);
  if (!rl.ok) {
    throw new Error(`تجاوزت الحد المسموح. حاول بعد ${Math.ceil(rl.retryInMs / 1000)} ثانية`);
  }
  const cleaned = filterMessage(body).trim();
  if (!cleaned) throw new Error("رسالة فارغة");
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: senderId, body: cleaned, delivered_at: new Date().toISOString() })
    .select()
    .single();
  if (error) throw error;
  return data as Message;
}

export async function markConversationRead(conversationId: string, _myId: string) {
  await supabase.rpc("mark_conversation_read", { _conversation_id: conversationId });
}

export async function setUsernameRpc(newUsername: string) {
  const { error } = await supabase.rpc("set_username", { _new: newUsername });
  if (error) throw error;
}

export type ChatVisibility = "everyone" | "friends" | "none";

export async function updateChatPrivacy(userId: string, opts: {
  privacy_last_seen?: ChatVisibility;
  privacy_friend_requests?: ChatVisibility;
  privacy_messages?: ChatVisibility;
  bio?: string;
}) {
  const { error } = await supabase.from("profiles").update(opts as any).eq("user_id", userId);
  if (error) throw error;
}

export async function heartbeatPresence() {
  await supabase.rpc("presence_heartbeat");
}

export async function fetchReactions(messageIds: string[]) {
  if (messageIds.length === 0) return [] as Reaction[];
  const { data } = await supabase
    .from("message_reactions")
    .select("*")
    .in("message_id", messageIds);
  return (data ?? []) as Reaction[];
}

export async function toggleReaction(messageId: string, userId: string, emoji: string) {
  const { data: existing } = await supabase
    .from("message_reactions")
    .select("id")
    .eq("message_id", messageId)
    .eq("user_id", userId)
    .eq("emoji", emoji)
    .maybeSingle();
  if (existing) {
    await supabase.from("message_reactions").delete().eq("id", existing.id);
  } else {
    await supabase.from("message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
  }
}

export async function submitReport(opts: {
  reporterId: string;
  targetUserId: string;
  targetMessageId?: string;
  reason: string;
}) {
  const { error } = await supabase.from("reports").insert({
    reporter_id: opts.reporterId,
    target_user_id: opts.targetUserId,
    target_message_id: opts.targetMessageId ?? null,
    reason: opts.reason,
  });
  if (error) throw error;
}

export async function fetchUnreadCount(myId: string) {
  const { count } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", myId)
    .is("read_at", null);
  return count ?? 0;
}

export async function fetchPresenceForUsers(ids: string[]) {
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("user_presence")
    .select("user_id, status, last_seen_at")
    .in("user_id", ids);
  return data ?? [];
}

export function isOnline(presence?: { status: string; last_seen_at: string }) {
  if (!presence) return false;
  if (presence.status !== "online") return false;
  const last = new Date(presence.last_seen_at).getTime();
  return Date.now() - last < 2 * 60 * 1000;
}

export function avatarPublicUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  const { data } = supabase.storage.from("avatars").getPublicUrl(path);
  return data.publicUrl;
}
