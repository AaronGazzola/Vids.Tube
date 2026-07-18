import { Volume2 } from "lucide-react";

export function TtsCard({
  authorName,
  text,
  audioSrc,
  audioKey,
  onDone,
}: {
  authorName: string | null;
  text: string;
  audioSrc: string;
  audioKey: string;
  onDone: () => void;
}) {
  return (
    <div className="mt-2 flex items-start gap-2 rounded-xl bg-black/80 px-4 py-3 text-white shadow-lg backdrop-blur">
      <Volume2 className="mt-0.5 h-5 w-5 shrink-0 text-indigo-400" />
      <div className="min-w-0">
        {authorName && (
          <p className="text-xs font-semibold text-indigo-300">
            {authorName.replace(/^@+/, "")}
          </p>
        )}
        <p className="text-sm leading-snug">{text}</p>
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
