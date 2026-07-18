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
  className = "h-5 w-5",
  size,
}: {
  metric: GoalMetric;
  className?: string;
  size?: number;
}) {
  const { body, stroke } = ICONS[metric];
  const sizeStyle = size ? { width: size, height: size } : undefined;
  const sizeClass = size ? "" : className;

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
  const d = Math.max(48, Math.round(height * 0.2));
  const stroke = Math.max(5, Math.round(d * 0.09));
  const r = (d - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const gap = circ * 0.08;
  const trackLen = circ - gap;
  const startOff = gap / 2;
  const pct = Math.max(0, Math.min(100, data.pct));
  const dash = (pct / 100) * trackLen;
  const inner = d - 2 * (stroke + 2);
  const maskId = `ring-track-${metric}`;
  const arcSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 ${d} ${d}'><circle cx='${d / 2}' cy='${d / 2}' r='${r}' fill='none' stroke='black' stroke-width='${stroke - 2}' stroke-linecap='round' stroke-dasharray='${trackLen} ${circ}' stroke-dashoffset='${-startOff}' transform='rotate(-90 ${d / 2} ${d / 2})'/></svg>`;
  const arcMask = `url("data:image/svg+xml,${encodeURIComponent(arcSvg)}")`;
  return (
    <div
      className="relative inline-flex items-center justify-center rounded-full bg-black/40 text-white"
      style={{ width: d, height: d }}
    >
      <svg className="absolute inset-0 -rotate-90" width={d} height={d}>
        <mask id={maskId}>
          <circle
            cx={d / 2}
            cy={d / 2}
            r={r}
            fill="none"
            stroke="white"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${trackLen} ${circ}`}
            strokeDashoffset={-startOff}
          />
          <circle
            cx={d / 2}
            cy={d / 2}
            r={r}
            fill="none"
            stroke="black"
            strokeWidth={stroke - 2}
            strokeLinecap="round"
            strokeDasharray={`${trackLen} ${circ}`}
            strokeDashoffset={-startOff}
          />
        </mask>
        <rect
          width={d}
          height={d}
          fill="white"
          mask={`url(#${maskId})`}
        />
        {!data.reached && (
          <circle
            cx={d / 2}
            cy={d / 2}
            r={r}
            fill="none"
            stroke="white"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            strokeDashoffset={-startOff}
          />
        )}
      </svg>
      {data.reached && (
        <div
          className="absolute inset-0"
          style={{ WebkitMaskImage: arcMask, maskImage: arcMask }}
        >
          <div className="rainbow-ring absolute inset-0" />
        </div>
      )}
      <div
        className="absolute flex flex-col items-center justify-center leading-none"
        style={{ inset: stroke + 4 }}
      >
        <Icon metric={metric} size={inner * 0.5} />
        <span
          className="font-bold tabular-nums"
          style={{ fontSize: inner * 0.32, lineHeight: 1 }}
        >
          {fmt(data.current)}
        </span>
      </div>
      {metric === "subs" && (
        <svg
          className="absolute -right-3.5 top-0 h-4.5 w-4.5"
          style={{ animation: "arrow-nudge 4s ease-in-out infinite" }}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 7h10v10" />
          <path d="M7 17 17 7" />
        </svg>
      )}
    </div>
  );
}
