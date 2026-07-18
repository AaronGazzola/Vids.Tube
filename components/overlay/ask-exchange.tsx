import type { FeaturedAuthor } from "@/app/layout.types";
import { Bot } from "lucide-react";
import { AuthorColumn, SpeechBubble } from "./speech-bubble";

export function AskExchangeView({
  author,
  rank,
  progress,
  question,
  answer,
  includeAnswer,
}: {
  author: FeaturedAuthor | null;
  rank: number;
  progress: number;
  question: string;
  answer: string | null;
  includeAnswer: boolean;
}) {
  return (
    <div className="w-full space-y-3 px-3">
      <div className="flex w-full items-start gap-3">
        <AuthorColumn author={author} rank={rank} progress={progress} />
        <SpeechBubble pointer="left">
          <p className="whitespace-pre-wrap">{question}</p>
        </SpeechBubble>
      </div>
      {includeAnswer && answer && (
        <div className="flex w-full items-start gap-3">
          <SpeechBubble pointer="right">
            <p className="whitespace-pre-wrap">{answer}</p>
          </SpeechBubble>
          <div
            className="flex shrink-0 flex-col items-center"
            style={{ width: 72 }}
          >
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-indigo-600 text-white"
              style={{ boxShadow: "0 0 18px 3px rgba(255,255,255,0.3)" }}
            >
              <Bot className="h-7 w-7" />
            </span>
            <span className="mt-1 text-xs font-bold text-white drop-shadow">
              VidsBot
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
