import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchGroup,
  fetchGroupMembers,
  fetchGroupMessages,
  fetchMyMembership,
  type Group,
  type GroupMember,
  type GroupMessage,
} from "@/lib/chat/groupQueries";

export function useGroupChat(groupId: string | undefined) {
  const { user } = useAuth();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [myMembership, setMyMembership] = useState<GroupMember | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId || !user) return;
    let active = true;

    const init = async () => {
      setLoading(true);
      const [g, mem, msgs, mine] = await Promise.all([
        fetchGroup(groupId),
        fetchGroupMembers(groupId),
        fetchGroupMessages(groupId),
        fetchMyMembership(groupId, user.id),
      ]);
      if (!active) return;
      setGroup(g);
      setMembers(mem);
      setMessages(msgs);
      setMyMembership(mine);
      setLoading(false);
    };
    init();

    const ch = supabase
      .channel(`group:${groupId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const msg = payload.new as GroupMessage;
          if (msg.deleted_at) return;
          setMessages((m) => (m.some((x) => x.id === msg.id) ? m : [...m, msg]));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "group_messages", filter: `group_id=eq.${groupId}` },
        (payload) => {
          const msg = payload.new as GroupMessage;
          setMessages((m) => (msg.deleted_at ? m.filter((x) => x.id !== msg.id) : m.map((x) => (x.id === msg.id ? msg : x))));
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "group_members", filter: `group_id=eq.${groupId}` },
        async () => {
          const [mem, mine] = await Promise.all([fetchGroupMembers(groupId), fetchMyMembership(groupId, user.id)]);
          if (!active) return;
          setMembers(mem);
          setMyMembership(mine);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "groups", filter: `id=eq.${groupId}` },
        (payload) => {
          setGroup((g) => (g ? { ...g, ...(payload.new as Group) } : (payload.new as Group)));
        }
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [groupId, user]);

  const isBanned = myMembership?.status === "banned";
  const isMember = myMembership?.status === "active";
  const isStaff = isMember && (myMembership?.role === "owner" || myMembership?.role === "admin");
  const isOwner = isMember && myMembership?.role === "owner";
  const canPost = isMember && (isStaff || !group?.lock_chat);

  return { group, members, messages, myMembership, loading, isMember, isBanned, isStaff, isOwner, canPost, setMessages };
}
