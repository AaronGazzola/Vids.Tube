"use client";

import { placeholderAvatar } from "@/lib/placeholder-avatar";
import {
  ArrowLeft,
  Crown,
  MoreVertical,
  Smile,
  ThumbsUp,
  Users,
} from "lucide-react";

// Reference geometry measured from the YouTube Android live layout at 1080px
// video width. Every dimension below is multiplied by `scale` at render time
// (scale = renderedVideoWidthPx / REF_WIDTH).
export const MOBILE_CHROME_REF_WIDTH = 1080;
export const CHROME_ABOVE = 96;
export const CHROME_BELOW = 90;

const TOP_BAR = {
  height: 96,
  padX: 24,
  backIcon: 40,
  avatar: 64,
  handleSize: 34,
  countsSize: 28,
  liveDot: 14,
  countIcon: 26,
  subscribeH: 62,
  subscribeW: 200,
  subscribeText: 30,
  menuIcon: 40,
  gap: 18,
};

const CHAT = {
  left: 36,
  right: 170,
  bottom: 40,
  rowGap: 16,
  avatar: 52,
  handleSize: 32,
  textSize: 34,
  badgeH: 40,
  badgeText: 26,
  badgeIcon: 22,
  noticeSize: 32,
};

const HEART = { size: 100, right: 36, bottom: 76 };

const INPUT = {
  width: 920,
  height: 90,
  left: 36,
  textSize: 34,
  icon: 44,
  overlap: 0.25,
};

const SAMPLE_VIEWERS = "14";
const SAMPLE_LIKES = "3";

const SAMPLE_ROWS: {
  handle: string;
  badge: string | null;
  text: string;
  opacity: number;
}[] = [
  {
    handle: "@PixelPenguin",
    badge: "#2",
    text: "Hello, creative developer! How are you? I hope you're doing well today.",
    opacity: 0.7,
  },
  {
    handle: "@KiwiByte",
    badge: "#3",
    text: "using Unity? or godot?",
    opacity: 0.8,
  },
  {
    handle: "@PixelPenguin",
    badge: "#2",
    text: "Do you know why I love and respect you so much?",
    opacity: 0.9,
  },
  {
    handle: "@LoopLagoon",
    badge: null,
    text: "Genuinely mind boggling how good you are at this, good stuff",
    opacity: 1,
  },
];

const NOTICE_TEXT =
  "Welcome to live chat! Remember to guard your privacy and abide by our Community Guidelines.";

export function MobileChromeTopBar({
  scale,
  handle,
  avatarUrl,
}: {
  scale: number;
  handle: string | null;
  avatarUrl: string | null;
}) {
  const s = (n: number) => n * scale;
  const shownHandle = handle ? `@${handle.replace(/^@/, "")}` : "@channel";
  return (
    <div
      className="pointer-events-none flex w-full select-none items-center bg-black text-white"
      style={{
        height: s(TOP_BAR.height),
        paddingLeft: s(TOP_BAR.padX),
        paddingRight: s(TOP_BAR.padX),
        gap: s(TOP_BAR.gap),
      }}
    >
      <ArrowLeft style={{ width: s(TOP_BAR.backIcon), height: s(TOP_BAR.backIcon) }} />
      <img
        src={avatarUrl ?? placeholderAvatar(shownHandle)}
        alt=""
        className="rounded-full object-cover"
        style={{ width: s(TOP_BAR.avatar), height: s(TOP_BAR.avatar) }}
      />
      <div className="flex min-w-0 flex-col" style={{ gap: s(4) }}>
        <span
          className="truncate font-semibold leading-none"
          style={{ fontSize: s(TOP_BAR.handleSize) }}
        >
          {shownHandle}
        </span>
        <span
          className="flex items-center leading-none text-white/70"
          style={{ fontSize: s(TOP_BAR.countsSize), gap: s(10) }}
        >
          <span
            className="rounded-full bg-red-600"
            style={{ width: s(TOP_BAR.liveDot), height: s(TOP_BAR.liveDot) }}
          />
          <Users style={{ width: s(TOP_BAR.countIcon), height: s(TOP_BAR.countIcon) }} />
          {SAMPLE_VIEWERS}
          <ThumbsUp
            style={{ width: s(TOP_BAR.countIcon), height: s(TOP_BAR.countIcon) }}
          />
          {SAMPLE_LIKES}
        </span>
      </div>
      <div className="ml-auto flex items-center" style={{ gap: s(TOP_BAR.gap) }}>
        <span
          className="flex items-center justify-center rounded-full bg-white font-medium text-black"
          style={{
            height: s(TOP_BAR.subscribeH),
            width: s(TOP_BAR.subscribeW),
            fontSize: s(TOP_BAR.subscribeText),
          }}
        >
          Subscribe
        </span>
        <MoreVertical
          style={{ width: s(TOP_BAR.menuIcon), height: s(TOP_BAR.menuIcon) }}
        />
      </div>
    </div>
  );
}

function ChatRow({
  scale,
  row,
}: {
  scale: number;
  row: (typeof SAMPLE_ROWS)[number];
}) {
  const s = (n: number) => n * scale;
  return (
    <div
      className="flex items-start"
      style={{ gap: s(14), opacity: row.opacity }}
    >
      <img
        src={placeholderAvatar(row.handle)}
        alt=""
        className="shrink-0 rounded-full"
        style={{ width: s(CHAT.avatar), height: s(CHAT.avatar) }}
      />
      {row.badge && (
        <span
          className="flex shrink-0 items-center rounded-full bg-indigo-600 font-semibold text-white"
          style={{
            height: s(CHAT.badgeH),
            paddingLeft: s(12),
            paddingRight: s(12),
            fontSize: s(CHAT.badgeText),
            gap: s(6),
            marginTop: s(6),
          }}
        >
          <Crown style={{ width: s(CHAT.badgeIcon), height: s(CHAT.badgeIcon) }} />
          {row.badge}
        </span>
      )}
      <p
        className="min-w-0 leading-snug text-white"
        style={{
          fontSize: s(CHAT.textSize),
          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
        }}
      >
        <span className="font-semibold" style={{ fontSize: s(CHAT.handleSize) }}>
          {row.handle}
        </span>{" "}
        {row.text}
      </p>
    </div>
  );
}

export function MobileChromeOverlay({ scale }: { scale: number }) {
  const s = (n: number) => n * scale;
  return (
    <div className="pointer-events-none absolute inset-0 select-none">
      <div
        className="absolute flex flex-col justify-end"
        style={{
          left: s(CHAT.left),
          right: s(CHAT.right),
          bottom: s(CHAT.bottom),
          gap: s(CHAT.rowGap),
        }}
      >
        {SAMPLE_ROWS.map((row, i) => (
          <ChatRow key={i} scale={scale} row={row} />
        ))}
        <p
          className="leading-snug text-white/90"
          style={{
            fontSize: s(CHAT.noticeSize),
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          }}
        >
          {NOTICE_TEXT} <span className="text-sky-400">Learn more</span>
        </p>
      </div>

      <div
        className="absolute flex items-center justify-center rounded-full bg-red-600"
        style={{
          width: s(HEART.size),
          height: s(HEART.size),
          right: s(HEART.right),
          bottom: s(HEART.bottom),
        }}
      >
        <svg
          viewBox="0 0 24 24"
          fill="white"
          style={{ width: s(52), height: s(52) }}
        >
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      </div>

      <div
        className="absolute flex items-center rounded-full"
        style={{
          left: s(INPUT.left),
          width: s(INPUT.width),
          height: s(INPUT.height),
          bottom: -s(INPUT.height * (1 - INPUT.overlap)),
          backgroundColor: "#2a2a2a",
          paddingLeft: s(32),
          paddingRight: s(24),
        }}
      >
        <span
          className="flex-1 text-neutral-400"
          style={{ fontSize: s(INPUT.textSize) }}
        >
          Chat...
        </span>
        <Smile
          className="text-neutral-400"
          style={{ width: s(INPUT.icon), height: s(INPUT.icon) }}
        />
      </div>
    </div>
  );
}
