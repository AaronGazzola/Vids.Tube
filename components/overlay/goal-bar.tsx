import type { GoalMetric, MetricProgress } from "@/app/layout.types";

function fmt(n: number) {
  return n.toLocaleString();
}

const ICONS: Record<GoalMetric, { body: string; stroke?: boolean }> = {
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
};

function Icon({
  metric,
  reached,
  className = "h-5 w-5",
  size,
}: {
  metric: GoalMetric;
  reached: boolean;
  className?: string;
  size?: number;
}) {
  const { body, stroke } = ICONS[metric];
  const sizeStyle = size ? { width: size, height: size } : undefined;
  const sizeClass = size ? "" : className;

  if (reached) {
    const attrs = stroke
      ? "fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'"
      : "fill='black'";
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' ${attrs}>${body}</svg>`;
    const mask = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
    const maskStyle = { WebkitMaskImage: mask, maskImage: mask };
    return (
      <span className={`relative block ${sizeClass}`} style={sizeStyle}>
        <span
          className="rainbow-mask absolute inset-0 bg-white"
          style={maskStyle}
        />
        <span
          className="rainbow-icon rainbow-mask absolute inset-0 opacity-70"
          style={maskStyle}
        />
      </span>
    );
  }

  return (
    <svg
      className={sizeClass}
      style={sizeStyle}
      viewBox="0 0 24 24"
      fill={stroke ? "none" : "currentColor"}
      stroke={stroke ? "currentColor" : undefined}
      strokeWidth={stroke ? 2 : undefined}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

export function GoalBar({
  metric,
  data,
  height = 320,
}: {
  metric: GoalMetric;
  data: MetricProgress;
  height?: number;
}) {
  const glow = data.reached
    ? "0 0 22px 2px rgba(255,255,255,0.55)"
    : undefined;

  const icon = (
    <span className="text-white">
      <Icon metric={metric} reached={data.reached} />
    </span>
  );

  if (metric === "viewers") {
    const d = Math.max(48, Math.round(height * 0.2));
    const stroke = Math.max(5, Math.round(d * 0.09));
    const r = (d - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const pct = Math.max(0, Math.min(100, data.pct));
    const dash = (pct / 100) * circ;
    const inner = d - 2 * (stroke + 2);
    return (
      <div
        className="relative inline-flex items-center justify-center rounded-full text-white"
        style={{ width: d, height: d, boxShadow: glow }}
      >
        {data.reached ? (
          <div
            className="absolute inset-0 overflow-hidden rounded-full"
            style={{
              WebkitMaskImage: `radial-gradient(farthest-side, transparent calc(100% - ${stroke}px), #000 calc(100% - ${stroke}px))`,
              maskImage: `radial-gradient(farthest-side, transparent calc(100% - ${stroke}px), #000 calc(100% - ${stroke}px))`,
            }}
          >
            <div className="rainbow-ring absolute inset-0" />
          </div>
        ) : (
          <svg className="absolute inset-0 -rotate-90" width={d} height={d}>
            <circle
              cx={d / 2}
              cy={d / 2}
              r={r}
              fill="none"
              stroke="white"
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={`${dash} ${circ}`}
            />
          </svg>
        )}
        <div
          className="absolute flex flex-col items-center justify-center leading-none"
          style={{ inset: stroke + 4 }}
        >
          <Icon metric="viewers" reached={data.reached} size={inner * 0.5} />
          <span
            className="font-bold tabular-nums"
            style={{ fontSize: inner * 0.32, lineHeight: 1 }}
          >
            {fmt(data.current)}
          </span>
        </div>
      </div>
    );
  }

  if (metric === "subs") {
    return (
      <div className="inline-flex items-start gap-2 rounded-2xl p-1 text-white">
        <div
          className={`relative mt-1 h-1.5 overflow-hidden rounded-full border ${
            data.reached ? "border-transparent" : "border-white"
          }`}
          style={{ width: height * 0.96 }}
        >
          <div
            className={`absolute left-0 top-0 h-full rounded-full transition-[width] duration-700 ease-out ${
              data.reached ? "rainbow-bar-h" : "bg-white"
            }`}
            style={{ width: `${data.pct}%` }}
          />
        </div>
        <div className="mt-1 flex flex-col items-center leading-tight">
          <Icon metric="subs" reached={data.reached} className="h-6 w-6" />
          <span className="mt-0.5 text-sm font-bold tabular-nums">
            {fmt(data.current)}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="inline-flex flex-col items-center rounded-2xl px-2 py-2 text-center text-white">
      <span className="-translate-x-1.5">{icon}</span>
      <span className="mt-0.5 -translate-x-1.5 text-sm font-bold leading-none tabular-nums">
        {fmt(data.current)}
      </span>
      <div
        className={`relative my-2 w-1.5 self-end overflow-hidden rounded-full border ${
          data.reached ? "border-transparent" : "border-white"
        }`}
        style={{ height: height * 1.35 }}
      >
        <div
          className={`absolute bottom-0 left-0 w-full rounded-full transition-[height] duration-700 ease-out ${
            data.reached ? "rainbow-bar-v" : "bg-white"
          }`}
          style={{ height: `${data.pct}%` }}
        />
      </div>
    </div>
  );
}
