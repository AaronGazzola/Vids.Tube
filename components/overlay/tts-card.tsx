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
        <AuthorColumn
          author={author}
          rank={rank}
          progress={progress}
          cornerIcon={<Volume2 className="h-[58%] w-[58%]" />}
        />
        <SpeechBubble pointer="left">
          <p className="whitespace-pre-wrap">{text}</p>
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
