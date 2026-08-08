import { cn } from "@/lib/utils";

export function Logo({
  className,
  solid = false,
}: {
  className?: string;
  // The wings are translucent wherever the logo sits on a page, so it settles
  // into the surface behind it. On a broadcast overlay there is no surface to
  // settle into — it is read at a distance over moving video — so it goes solid.
  solid?: boolean;
}) {
  const wingOpacity = solid ? 1 : 0.5;
  return (
    <svg
      viewBox="0 0 48 38"
      className={cn("text-white dark:text-black", className)}
      fill="none"
      aria-hidden="true"
    >
      <polygon
        points="30,38 1,5 21,5"
        fill="#FF00FF"
        opacity={wingOpacity}
      />
      <polygon
        points="18,38 47,5 27,5"
        fill="#00CCB3"
        opacity={wingOpacity}
      />
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
