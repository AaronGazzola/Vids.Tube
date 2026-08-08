const STRIP_WIDTH = 810;

// A wide, short banner rather than a stacked card: the strip competes for
// vertical space with the goals, the ladder and the highlight surface on a
// 1080 x 1920 canvas, so it spends the axis it can afford.
//
// The count and its label are sized close together on purpose. The number alone
// means nothing to someone seeing it for the first time; "MEMBERS" is what makes
// it an invitation rather than a statistic.
export function MemberCountStrip({ count }: { count: number }) {
  return (
    <div
      style={{ width: STRIP_WIDTH }}
      className="overlay-surface flex items-center gap-8 rounded-2xl border-2 border-white px-8 py-5 text-white shadow-lg backdrop-blur-sm"
    >
      <p className="min-w-0 flex-1 text-[40px] font-semibold leading-[1.15]">
        Chat to become a member
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
