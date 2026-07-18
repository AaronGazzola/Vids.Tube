import { Bot, MessageCircleQuestion } from "lucide-react";

export function AskExchangeView({
  authorName,
  question,
  answer,
  includeAnswer,
}: {
  authorName: string | null;
  question: string;
  answer: string | null;
  includeAnswer: boolean;
}) {
  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-start gap-2 rounded-xl bg-black/80 px-4 py-3 text-white shadow-lg backdrop-blur">
        <MessageCircleQuestion className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
        <div className="min-w-0">
          {authorName && (
            <p className="text-xs font-semibold text-amber-300">
              {authorName.replace(/^@+/, "")}
            </p>
          )}
          <p className="text-sm leading-snug">{question}</p>
        </div>
      </div>
      {includeAnswer && answer && (
        <div className="ml-8 flex flex-row-reverse items-start gap-2 rounded-xl bg-indigo-950/90 px-4 py-3 text-white shadow-lg backdrop-blur">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-600">
            <Bot className="h-4 w-4" />
          </span>
          <div className="min-w-0 text-left">
            <p className="text-xs font-semibold text-indigo-300">VidsBot</p>
            <p className="text-sm leading-snug">{answer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
