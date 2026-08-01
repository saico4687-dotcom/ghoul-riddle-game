import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchMyGroups,
  createGroup as createGroupQuery,
  joinGroupByInvite as joinGroupByInviteQuery,
  type Group,
} from "@/lib/chat/groupQueries";

export type MyGroup = Group & { myRole: "owner" | "admin" | "member"; archived: boolean; pinned: boolean };

export function useGroups() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<MyGroup[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchMyGroups(user.id);
      setGroups(data as MyGroup[]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    reload();
  }, [reload]);

  const createGroup = useCallback(
    async (input: { name: string; description?: string | null; avatarUrl?: string | null }) => {
      const group = await createGroupQuery(input);
      await reload();
      return group;
    },
    [reload]
  );

  const joinByInvite = useCallback(
    async (inviteCode: string) => {
      const groupId = await joinGroupByInviteQuery(inviteCode);
      await reload();
      return groupId;
    },
    [reload]
  );

  return { groups, loading, reload, createGroup, joinByInvite };
}
