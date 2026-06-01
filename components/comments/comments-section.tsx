"use client";

import { useAuthStore } from "@/app/layout.stores";
import { useComments, usePostComment } from "@/app/watch/[videoId]/page.hooks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRouter } from "next/navigation";
import { CommentForm } from "./comment-form";
import { CommentItem } from "./comment-item";

type CommentsSectionProps = {
  videoId: string;
};

export function CommentsSection({ videoId }: CommentsSectionProps) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { data: comments, isPending, isError } = useComments(videoId);
  const postComment = usePostComment(videoId);

  const promptSignIn = () => router.push("/login");

  const total = comments?.length ?? 0;

  return (
    <section className="mt-8 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">
          Comments{" "}
          <span className="text-muted-foreground">
            {isPending ? "" : `· ${total}`}
          </span>
        </h2>
      </header>

      {isAuthenticated ? (
        <CommentForm
          submitLabel="Comment"
          placeholder="Add a comment"
          pending={postComment.isPending}
          onSubmit={async (body) => {
            await postComment.mutateAsync(body);
          }}
        />
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-3 text-sm">
          <span className="text-muted-foreground">
            Sign in to leave a comment.
          </span>
          <Button size="sm" onClick={promptSignIn}>
            Log in
          </Button>
        </div>
      )}

      {isPending ? (
        <div className="flex flex-col gap-6">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-16 w-8 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : isError ? (
        <p className="text-sm text-destructive">
          Couldn&apos;t load comments. Try refreshing the page.
        </p>
      ) : total === 0 ? (
        <p className="text-sm text-muted-foreground">
          No comments yet. Be the first to share what you think.
        </p>
      ) : (
        <ol className="flex flex-col gap-6">
          {comments!.map((comment) => (
            <li key={comment.id}>
              <CommentItem
                videoId={videoId}
                comment={comment}
                isAuthenticated={isAuthenticated}
                onPromptSignIn={promptSignIn}
              />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
