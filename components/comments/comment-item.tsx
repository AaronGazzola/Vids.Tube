"use client";

import { useAuthStore } from "@/app/layout.stores";
import {
  useDeleteComment,
  useEditComment,
  useVoteComment,
} from "@/app/watch/[videoId]/page.hooks";
import type { ScoredComment, VoteValue } from "@/app/watch/[videoId]/page.types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { CommentForm } from "./comment-form";

type CommentItemProps = {
  videoId: string;
  comment: ScoredComment;
  isAuthenticated: boolean;
  onPromptSignIn: () => void;
};

function formatAuthor(userId: string): string {
  return userId.slice(0, 8);
}

function formatRelative(value: string): string {
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) {
    return "";
  }
  const seconds = Math.max(1, Math.floor((Date.now() - then) / 1000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function CommentItem({
  videoId,
  comment,
  isAuthenticated,
  onPromptSignIn,
}: CommentItemProps) {
  const currentUser = useAuthStore((state) => state.user);
  const isAuthor = !!currentUser && currentUser.id === comment.userId;

  const voteComment = useVoteComment(videoId);
  const editComment = useEditComment(videoId);
  const deleteComment = useDeleteComment(videoId);

  const [editing, setEditing] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const handleVote = (target: Exclude<VoteValue, 0>) => {
    if (!isAuthenticated) {
      onPromptSignIn();
      return;
    }
    const nextValue: VoteValue =
      comment.viewerVote === target ? 0 : target;
    voteComment.mutate({ commentId: comment.id, value: nextValue });
  };

  const handleEditSubmit = async (body: string) => {
    await editComment.mutateAsync({ commentId: comment.id, body });
    setEditing(false);
  };

  const handleConfirmDelete = () => {
    deleteComment.mutate(comment.id, {
      onSuccess: () => setConfirmDeleteOpen(false),
    });
  };

  return (
    <article className="flex gap-3">
      <div className="flex flex-col items-center gap-0.5 text-muted-foreground">
        <button
          type="button"
          aria-label="Upvote"
          aria-pressed={comment.viewerVote === 1}
          onClick={() => handleVote(1)}
          className={cn(
            "rounded p-1 transition-colors hover:bg-muted hover:text-foreground",
            comment.viewerVote === 1 && "text-primary"
          )}
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <span
          className={cn(
            "min-w-[1.5rem] text-center text-xs font-medium tabular-nums",
            comment.viewerVote === 1 && "text-primary",
            comment.viewerVote === -1 && "text-destructive"
          )}
        >
          {comment.score}
        </span>
        <button
          type="button"
          aria-label="Downvote"
          aria-pressed={comment.viewerVote === -1}
          onClick={() => handleVote(-1)}
          className={cn(
            "rounded p-1 transition-colors hover:bg-muted hover:text-foreground",
            comment.viewerVote === -1 && "text-destructive"
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <header className="flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-sm font-medium">
              {formatAuthor(comment.userId)}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatRelative(comment.createdAt)}
              {comment.editedAt && (
                <span className="ml-1 italic">(edited)</span>
              )}
            </span>
          </div>
          {isAuthor && !editing && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Comment actions"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </header>
        {editing ? (
          <CommentForm
            initialValue={comment.body}
            submitLabel="Save"
            pending={editComment.isPending}
            autoFocus
            onSubmit={handleEditSubmit}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {comment.body}
          </p>
        )}
      </div>
      <AlertDialog
        open={confirmDeleteOpen}
        onOpenChange={setConfirmDeleteOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the comment and any votes on it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteComment.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleConfirmDelete();
              }}
              disabled={deleteComment.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteComment.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  );
}
