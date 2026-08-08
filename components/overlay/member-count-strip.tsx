const STRIP_WIDTH = 810;

// A wide, short banner rather than a stacked card: the strip competes for
// vertical space with the goals, the ladder and the highlight surface on a
// 1080 x 1920 canvas, so it spends the axis it can afford.
//
// The count reads as a phrase down the right-hand side — 143 / Vids.tube /
// Members — so the number carries the name of the place with it.
export function MemberCountStrip({ count }: { count: number }) {
  return (
    <div
      style={{ width: STRIP_WIDTH }}
      className="overlay-surface flex items-center gap-8 rounded-2xl border border-white/15 px-8 py-5 text-white shadow-lg backdrop-blur-sm"
    >
      <p className="min-w-0 flex-1 text-[38px] font-semibold leading-[1.15]">
        Join the chat to become a member
      </p>

      <div className="flex shrink-0 flex-col items-center leading-none">
        <span className="text-[64px] font-bold tabular-nums tracking-tight">
          {count.toLocaleString("en-US")}
        </span>
        <span className="mt-1.5 text-[22px] font-semibold tracking-tight">
          Vids.tube
        </span>
        <span className="mt-1 text-[14px] font-semibold uppercase tracking-[0.24em] text-white/60">
          Members
        </span>
      </div>
    </div>
  );
}
