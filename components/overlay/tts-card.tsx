import type { FeaturedAuthor } from "@/app/layout.types";
import { Volume2 } from "lucide-react";
import { AuthorColumn, SpeechBubble } from "./speech-bubble";

export function TtsCard({
  author,
  rank,
  progress,
  text,
  audioSrc,
  audioKey,
  onDone,
}: {
  author: FeaturedAuthor | null;
  rank: number;
  progress: number;
  text: string;
  audioSrc: string;
  audioKey: string;
  onDone: () => void;
}) {
  return (
    <div className="w-full px-3">
      <div className="flex w-full items-start gap-3">
        <AuthorColumn author={author} rank={rank} progress={progress} />
        <SpeechBubble pointer="left">
          <p className="whitespace-pre-wrap">
            <Volume2 className="mr-1.5 inline h-4 w-4 align-[-2px] text-indigo-400" />
            {text}
          </p>
        </SpeechBubble>
      </div>
      <audio
        key={audioKey}
        src={audioSrc}
        autoPlay
        onEnded={onDone}
        onError={onDone}
      />
    </div>
  );
}
