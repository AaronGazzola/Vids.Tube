import { parseOverlayMessage } from "@/lib/overlay-markup";
import { cn } from "@/lib/utils";

// A parsed message drawn as elements, one per run. No message is ever handed to
// the browser as markup, so there is no injection path and no sanitiser to get
// wrong.
export function OverlayMessage({
  text,
  className,
  "data-testid": testId,
}: {
  text: string;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <span className={className} data-testid={testId}>
      {parseOverlayMessage(text).map((run, i) => (
        <span
          key={i}
          className={cn(
            run.bold && "font-bold",
            run.italic && "italic",
            run.underline && "underline"
          )}
          style={run.color ? { color: run.color } : undefined}
        >
          {run.text}
        </span>
      ))}
    </span>
  );
}
