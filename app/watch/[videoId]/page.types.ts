import type { AuthorIdentity } from "@/app/layout.types";
import type { Database } from "@/supabase/types";

export type Video = Database["public"]["Tables"]["videos"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type CommentVote = Database["public"]["Tables"]["comment_votes"]["Row"];

export type VoteValue = -1 | 0 | 1;

export type ChatReplayRow = {
  id: string;
  user_id: string | null;
  origin: string;
  author: AuthorIdentity | null;
  author_name: string | null;
  author_avatar_url: string | null;
  body: string;
  created_at: string;
};

export type ChatReplay = {
  startedAt: string | null;
  messages: ChatReplayRow[];
};

export type ReplayMessage = {
  id: string;
  userId: string | null;
  origin: string;
  author: AuthorIdentity | null;
  author_name: string | null;
  author_avatar_url: string | null;
  body: string;
  offsetMs: number;
};

export type ScoredComment = {
  id: string;
  videoId: string;
  userId: string;
  author: AuthorIdentity;
  body: string;
  createdAt: string;
  editedAt: string | null;
  score: number;
  viewerVote: VoteValue;
};
