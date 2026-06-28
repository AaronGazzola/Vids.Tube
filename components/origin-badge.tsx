import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

export function OriginBadge({
  origin,
  className,
}: {
  origin: string | null | undefined;
  className?: string;
}) {
  if (origin === "youtube") {
    return (
      <span
        title="YouTube"
        className={cn(
          "inline-flex items-center rounded bg-red-600 px-1 text-[0.5rem] font-bold leading-tight text-white align-middle",
          className
        )}
      >
        YT
      </span>
    );
  }
  return (
    <span
      title="Vids.Tube"
      className={cn(
        "inline-flex items-center justify-center rounded bg-neutral-900 px-0.75 py-0.5 align-middle",
        className
      )}
    >
      <Logo className="h-3 w-3.5 text-white dark:text-white" />
    </span>
  );
}
