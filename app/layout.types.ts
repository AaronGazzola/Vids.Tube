import type { Database } from "@/supabase/types";
import type { User } from "@supabase/supabase-js";

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
};

export type AuthCredentials = {
  email: string;
  password: string;
};

export type SignUpInput = {
  email: string;
  password: string;
  handle: string;
};

export type SignUpDecision = {
  action: "signup" | "resend" | "signin";
  handle: string;
  email: string;
};

export type ActionResult<T> = { data: T } | { error: string };

export type Channel = Database["public"]["Tables"]["channels"]["Row"];
export type Stream = Database["public"]["Tables"]["streams"]["Row"];

export type AuthorIdentity = {
  handle: string;
  avatarPath: string | null;
} | null;

export type ChatMessageRow =
  Database["public"]["Tables"]["chat_messages"]["Row"];
export type ChatMessage = ChatMessageRow & { author: AuthorIdentity };

export const MAX_CHAT_MESSAGE_LENGTH = 200;

export type ViewerCapState = "connecting" | "admitted" | "full";

export type FeaturedMessage =
  Database["public"]["Tables"]["featured_messages"]["Row"];
export type ViewerScore =
  Database["public"]["Tables"]["viewer_scores"]["Row"];
export type ScoreEvent = Database["public"]["Tables"]["score_events"]["Row"];
export type ChatScoringState =
  Database["public"]["Tables"]["chat_scoring_state"]["Row"];
export type TranscriptSegment =
  Database["public"]["Tables"]["transcript_segments"]["Row"];

export type YouTubeVideoData = {
  likeCount: number;
  concurrentViewers: number;
  channelId: string;
  activeLiveChatId: string | null;
  liveBroadcastContent: string;
  title: string;
};

export type YouTubeChatMessage = {
  author: string;
  authorChannelId: string;
  avatarUrl: string;
  text: string;
  publishedAt: string;
};

export type YouTubeChatPage = {
  messages: YouTubeChatMessage[];
  nextPageToken: string | null;
  pollingIntervalMillis: number;
};

export type FeaturedAuthor = {
  name: string;
  handle: string | null;
  avatarUrl: string | null;
  avatarPath: string | null;
};

export type FeaturedMessageWithAuthor = FeaturedMessage & {
  author: FeaturedAuthor | null;
};

export type ViewerScoreWithAuthor = ViewerScore & {
  author: FeaturedAuthor | null;
};

export type CreateChannelInput = {
  handle: string;
  name?: string;
};

export type UpdateChannelInput = {
  channelId: string;
  name: string;
  handle: string;
  description: string;
};

export type HandleAvailability = {
  handle: string;
  available: boolean;
};
