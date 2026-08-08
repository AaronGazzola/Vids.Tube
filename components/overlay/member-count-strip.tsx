import { Logo } from "@/components/logo";
import { OVERLAY_SURFACE_ALPHA } from "@/lib/demo-overlay";

const STRIP_WIDTH = 810;

// A wide, short banner rather than a stacked card: the strip competes for
// vertical space with the goals, the ladder and the highlight surface on a
// 1080 x 1920 canvas, so it spends the axis it can afford.
//
// No backdrop blur. Blur frosts whatever is behind the strip, which reads as a
// solid panel however far the opacity is wound down — it defeated the control
// rather than obeying it. The backing is black alone, scaled by the slider.
export function MemberCountStrip({ count }: { count: number }) {
  return (
    <div
      style={
        {
          width: STRIP_WIDTH,
          "--overlay-surface-alpha": OVERLAY_SURFACE_ALPHA.members,
        } as React.CSSProperties
      }
      className="overlay-surface flex items-center gap-6 rounded-2xl border border-white px-6 py-3 text-white shadow-lg"
    >
      {/* One line, never wrapped: the strip is a glance, and a call to action
          that breaks mid-sentence stops being one. */}
      <p className="min-w-0 flex-1 whitespace-nowrap text-[32px] font-semibold leading-[1.15]">
        Chat to become a member at Vids.Tube!
      </p>

      {/* The mark carries the meaning a label used to: the site's own logo beside
          a figure says what is being counted without spending a word on it.
          Same size class as the sidebar, and pinned to the dark-mode letter in
          both themes — an overlay sits on a broadcast, not on a page, so it must
          not follow the owner's light or dark preference. */}
      <div className="flex shrink-0 items-center gap-2.5 leading-none">
        <Logo solid className="h-auto w-9 shrink-0 text-black dark:text-black" />
        <span className="text-[38px] font-bold tabular-nums tracking-tight">
          {count.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  );
}
