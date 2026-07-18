import type { Tables } from "@/supabase/types";

export type ChannelCommand = Pick<
  Tables<"chat_commands">,
  "keyword" | "description" | "cooldown_s" | "max_per_stream"
>;

export type ChannelCommandGuide = {
  channelName: string;
  handle: string | null;
  commands: ChannelCommand[];
};
