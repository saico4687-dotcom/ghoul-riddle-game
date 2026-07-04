import { supabase } from "@/integrations/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

// Broadcasts typing indicators over a per-conversation Realtime channel.
// No DB writes: typing is ephemeral state, cleaned up automatically when the sender stops.

export function typingChannel(conversationId: string): RealtimeChannel {
  return supabase.channel(`typing:${conversationId}`, {
    config: { broadcast: { self: false } },
  });
}

export async function sendTyping(channel: RealtimeChannel, userId: string) {
  await channel.send({
    type: "broadcast",
    event: "typing",
    payload: { userId, ts: Date.now() },
  });
}
