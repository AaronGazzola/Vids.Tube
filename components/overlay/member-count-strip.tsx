import { UserStar } from "lucide-react";

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
      style={{ width: STRIP_WIDTH }}
      className="overlay-surface flex items-center gap-6 rounded-2xl border border-white px-6 py-3 text-white shadow-lg"
    >
      {/* One line, never wrapped: the strip is a glance, and a call to action
          that breaks mid-sentence stops being one. */}
      <p className="min-w-0 flex-1 whitespace-nowrap text-[34px] font-semibold leading-[1.15]">
        Chat to become a Vids.Tube member
      </p>

      {/* The icon carries the meaning the word used to: a figure beside a member
          mark needs no label to say what it counts. */}
      <div className="flex shrink-0 items-center gap-2.5 leading-none">
        <UserStar className="h-9 w-9 shrink-0" aria-hidden />
        <span className="text-[38px] font-bold tabular-nums tracking-tight">
          {count.toLocaleString("en-US")}
        </span>
      </div>
    </div>
  );
}
