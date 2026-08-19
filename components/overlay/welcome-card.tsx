"use client";

import type { FeaturedAuthor } from "@/app/layout.types";
import { AvatarBubble } from "@/components/overlay/avatar-bubble";
import { SpeechBubble } from "@/components/overlay/speech-bubble";

export const WELCOME_HOLD_MS = 8000;

// An arrival has no standing yet, so the rank badge and the progress ring are
// both suppressed: a rank on a welcome card would be a claim nobody made.
const NO_STANDING = { rank: 99, progress: 0 };

function nameOf(author: FeaturedAuthor): string {
  return author.handle ? `@${author.handle}` : author.name;
}

// The words on the broadcast, which are not the words sent to chat. The chat
// greeting is shaped by YouTube's 200-character limit and carries a link, and a
// link is not something a viewer can click on a video.
export function welcomeText(
  kind: "new" | "returning" | "batch",
  authors: FeaturedAuthor[]
): { lead: string; body: string } {
  if (kind === "batch") {
    return {
      lead: "New members",
      body: `${authors.map(nameOf).join(", ")} just joined the community!`,
    };
  }
  if (kind === "new") {
    return {
      lead: "New member",
      body: `${nameOf(authors[0])} just joined the community!`,
    };
  }
  return { lead: "Welcome back", body: `Good to see you, ${nameOf(authors[0])}.` };
}

export function WelcomeCard({
  kind,
  authors,
  size = 72,
  onDone,
}: {
  kind: "new" | "returning" | "batch";
  authors: FeaturedAuthor[];
  size?: number;
  onDone: () => void;
}) {
  const { lead, body } = welcomeText(kind, authors);

  return (
    <div
      className="w-full px-3"
      style={{
        animation: `highlight-pop ${WELCOME_HOLD_MS}ms ease-in-out forwards`,
      }}
      onAnimationEnd={onDone}
      data-testid="overlay-welcome-card"
      data-welcome-kind={kind}
    >
      {/* Avatar above, message below: an arrival's own shape, which reads at a
          glance as somebody appearing rather than as somebody being quoted. */}
      <div className="flex w-full flex-col items-center gap-6">
        <div className="flex items-end justify-center -space-x-3">
          {authors.slice(0, 5).map((author, i) => (
            <AvatarBubble
              key={`${author.handle ?? author.name}-${i}`}
              author={author}
              rank={NO_STANDING.rank}
              progress={NO_STANDING.progress}
              size={size}
              stroke={5}
              showBadge={false}
            />
          ))}
        </div>
        <SpeechBubble pointer="top">
          <p className="text-center">
            <span className="block text-sm font-bold uppercase tracking-wide opacity-80">
              {lead}
            </span>
            <span className="whitespace-pre-wrap">{body}</span>
          </p>
        </SpeechBubble>
      </div>
    </div>
  );
}
