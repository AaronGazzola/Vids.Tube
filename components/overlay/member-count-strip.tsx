const STRIP_WIDTH = 810;

// A wide, short banner rather than a stacked card: the strip competes for
// vertical space with the goals, the ladder and the highlight surface on a
// 1080 x 1920 canvas, so it spends the axis it can afford.
export function MemberCountStrip({
  count,
  siteLabel = "vids.tube",
}: {
  count: number;
  siteLabel?: string;
}) {
  return (
    <div
      style={{ width: STRIP_WIDTH }}
      className="flex items-center gap-6 rounded-2xl border border-white/15 bg-black/65 px-7 py-4 text-white shadow-lg backdrop-blur-sm"
    >
      <div className="flex shrink-0 flex-col items-center leading-none">
        <span className="text-[56px] font-bold tabular-nums tracking-tight">
          {count.toLocaleString("en-US")}
        </span>
        <span className="mt-1 text-[13px] font-semibold uppercase tracking-[0.22em] text-white/60">
          Members
        </span>
      </div>

      <div className="h-14 w-px shrink-0 bg-white/15" />

      <div className="min-w-0 flex-1">
        <p className="text-[26px] font-semibold leading-tight">
          Send a message in chat to join
        </p>
        <p className="mt-0.5 text-[22px] leading-tight text-white/70">
          See your stats at{" "}
          <span className="font-semibold text-white">{siteLabel}</span>
        </p>
      </div>
    </div>
  );
}
