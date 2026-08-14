import type { BannerIconName } from "@/app/(app)/live/demo.types";
import { Logo } from "@/components/logo";

// The three goal icons are the same drawings the goal bars use, so a subs
// metric on the banner reads as the subs goal does. The extras are the small
// set a streamer reaches for; anything richer belongs in a later change rather
// than in the layout config.
const PATHS: Record<Exclude<BannerIconName, "logo">, { body: string; stroke?: boolean }> = {
  subs: {
    body:
      "<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M19 8v6'/><path d='M22 11h-6'/>",
    stroke: true,
  },
  likes: {
    body:
      "<path d='M1 21h4V9H1v12zM23 10c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z'/>",
  },
  viewers: {
    body:
      "<path d='M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5C21.27 7.61 17 4.5 12 4.5zm0 12a4.5 4.5 0 110-9 4.5 4.5 0 010 9zm0-7a2.5 2.5 0 100 5 2.5 2.5 0 000-5z'/>",
  },
  heart: {
    body:
      "<path d='M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z'/>",
  },
  star: {
    body:
      "<polygon points='12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2'/>",
  },
  flame: {
    body:
      "<path d='M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z'/>",
  },
  trophy: {
    body:
      "<path d='M6 9H4.5a2.5 2.5 0 0 1 0-5H6'/><path d='M18 9h1.5a2.5 2.5 0 0 0 0-5H18'/><path d='M4 22h16'/><path d='M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22'/><path d='M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22'/><path d='M18 2H6v7a6 6 0 0 0 12 0V2Z'/>",
    stroke: true,
  },
  bell: {
    body:
      "<path d='M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9'/><path d='M10.3 21a1.94 1.94 0 0 0 3.4 0'/>",
    stroke: true,
  },
  thumbsUp: {
    body:
      "<path d='M7 10v12'/><path d='M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z'/>",
    stroke: true,
  },
  users: {
    body:
      "<path d='M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2'/><circle cx='9' cy='7' r='4'/><path d='M22 21v-2a4 4 0 0 0-3-3.87'/><path d='M16 3.13a4 4 0 0 1 0 7.75'/>",
    stroke: true,
  },
  eye: {
    body:
      "<path d='M2.06 12.35a1 1 0 0 1 0-.7 10.94 10.94 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.94 10.94 0 0 1-19.88 0'/><circle cx='12' cy='12' r='3'/>",
    stroke: true,
  },
};

// An icon name this build does not know falls back to the logo rather than
// leaving a gap: a saved layout must never be able to break the banner.
export function BannerIcon({
  name,
  color,
  size = 36,
}: {
  name: BannerIconName;
  color: string;
  size?: number;
}) {
  if (name === "logo" || !(name in PATHS)) {
    // The logo keeps its own two-colour mark; only the letter follows the
    // chosen colour, which is the part that reads as ink.
    return (
      <span
        className="inline-flex shrink-0"
        style={{ width: size, color }}
        aria-hidden="true"
      >
        <Logo solid className="h-auto w-full" />
      </span>
    );
  }
  const icon = PATHS[name as Exclude<BannerIconName, "logo">];
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className="shrink-0"
      fill={icon.stroke ? "none" : color}
      stroke={icon.stroke ? color : undefined}
      strokeWidth={icon.stroke ? 2 : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: icon.body }}
    />
  );
}
