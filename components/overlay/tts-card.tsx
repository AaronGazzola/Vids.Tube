"use client";

import type { FeaturedAuthor } from "@/app/layout.types";
import { Volume2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AuthorColumn, SpeechBubble } from "./speech-bubble";

const MIN_VISIBLE_MS = 7000;

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
  const audioRef = useRef<HTMLAudioElement>(null);
  const firedRef = useRef(false);
  const [audioDone, setAudioDone] = useState(false);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setHeld(true), MIN_VISIBLE_MS);
    audioRef.current?.play().catch((e) => {
      console.error("tts audio playback failed:", e);
      setAudioDone(true);
    });
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (audioDone && held && !firedRef.current) {
      firedRef.current = true;
      onDone();
    }
  }, [audioDone, held, onDone]);

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
        ref={audioRef}
        src={audioSrc}
        onEnded={() => setAudioDone(true)}
        onError={() => {
          console.error(`tts audio failed to load: ${audioSrc}`);
          setAudioDone(true);
        }}
      />
    </div>
  );
}
