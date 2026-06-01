import type { Database } from "@/supabase/types";

export type Video = Database["public"]["Tables"]["videos"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type CommentVote = Database["public"]["Tables"]["comment_votes"]["Row"];

export type VoteValue = -1 | 0 | 1;

export type ScoredComment = {
  id: string;
  videoId: string;
  userId: string;
  body: string;
  createdAt: string;
  editedAt: string | null;
  score: number;
  viewerVote: VoteValue;
};
