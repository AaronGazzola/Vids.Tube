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
      className="overlay-surface flex items-center gap-8 rounded-2xl border border-white px-8 py-5 text-white shadow-lg"
    >
      {/* One line, never wrapped: the strip is a glance, and a call to action
          that breaks mid-sentence stops being one. */}
      <p className="min-w-0 flex-1 whitespace-nowrap text-[30px] font-semibold leading-[1.15]">
        Chat to become a member at Vids.Tube
      </p>

      <div className="flex shrink-0 flex-col items-center leading-none">
        <span className="text-[46px] font-bold tabular-nums tracking-tight">
          {count.toLocaleString("en-US")}
        </span>
        <span className="mt-2 text-[22px] font-semibold uppercase tracking-[0.2em] text-white/80">
          Members
        </span>
      </div>
    </div>
  );
}
