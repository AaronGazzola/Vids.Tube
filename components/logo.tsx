import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 38"
      className={cn("text-white dark:text-black", className)}
      fill="none"
      aria-hidden="true"
    >
      <polygon points="30,38 1,5 21,5" fill="#FF00FF" opacity="0.5" />
      <polygon points="18,38 47,5 27,5" fill="#00CCB3" opacity="0.5" />
      <text
        x="24.5"
        y="29"
        style={{ fontFamily: "var(--font-logo)" }}
        fontSize="34"
        textAnchor="middle"
        fill="currentColor"
      >
        T
      </text>
    </svg>
  );
}
