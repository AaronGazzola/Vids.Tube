"use client";

import { splitProfanity } from "@/lib/profanity";
import { cn } from "@/lib/utils";
import { useState } from "react";

function BadWord({ word }: { word: string }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <span
      role="button"
      tabIndex={0}
      title={revealed ? "click to hide" : "blurred — click to reveal"}
      onClick={() => setRevealed((r) => !r)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") setRevealed((r) => !r);
      }}
      className={cn(
        "cursor-pointer rounded align-baseline",
        !revealed && "select-none bg-white/10"
      )}
      style={!revealed ? { filter: "blur(5px)" } : undefined}
    >
      {word}
    </span>
  );
}

export function ChatText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const segments = splitProfanity(text);
  if (!segments.some((s) => s.bad)) {
    return <span className={cn("break-words", className)}>{text}</span>;
  }
  return (
    <span className={cn("break-words", className)}>
      {segments.map((s, i) =>
        s.bad ? <BadWord key={i} word={s.text} /> : <span key={i}>{s.text}</span>
      )}
    </span>
  );
}
