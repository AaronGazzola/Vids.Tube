"use client";


import { OverlayMessage } from "@/components/overlay/overlay-message";
import {
  DEFAULT_MEMBER_MESSAGE,
  OVERLAY_MESSAGE_DWELL_MS,
  OVERLAY_MESSAGE_ROW_H,
  OVERLAY_MESSAGE_TRANSITION_MS,
  OVERLAY_SURFACE_ALPHA,
} from "@/lib/demo-overlay";
import { cn } from "@/lib/utils";
import { BannerIcon } from "@/components/overlay/banner-icon";
import type { BannerMetricValues } from "@/lib/banner-metrics";
import { useEffect, useState } from "react";
import type { StripAlign, StripMessage , StripMetric } from "@/app/(app)/live/demo.types";

const STRIP_WIDTH = 810;

// One message on the banner, with whatever number that message asks for beside
// it. A message carrying no metric, or one whose number cannot be resolved,
// takes the full width: a zero would be a claim, and off air there is no viewer
// count to make.
// Exported so the editor can drop its editable element where the drawn text
// goes, which is what makes the banner the field rather than a picture of it.
export function MessageBannerRow({
  text,
  align,
  metric,
  value,
  children,
  className,
  style,
  "data-testid": testId,
}: {
  text?: string;
  align: StripAlign;
  metric?: StripMetric;
  value: number | null;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  "data-testid"?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-6", className)}
      style={{ height: OVERLAY_MESSAGE_ROW_H, ...style }}
      data-testid={testId}
    >
      {/* One line, never wrapped: the strip is a glance, and a call to action
          that breaks mid-sentence stops being one. */}
      {/* Centring is within the line the message has to itself. Beside the
          member total that line is the space left over, not the whole strip,
          which is the trade for keeping the count where it is. */}
      {children ?? (
      <OverlayMessage
        text={text ?? ""}
        data-testid="message-banner-text"
        className={cn(
          "min-w-0 flex-1 overflow-hidden whitespace-nowrap text-[32px] font-semibold leading-[1.15]",
          align === "center" && "text-center"
        )}
      />
      )}

      {/* The mark carries the meaning a label used to: the site's own logo beside
          a figure says what is being counted without spending a word on it.
          Same size class as the sidebar, and pinned to the dark-mode letter in
          both themes — an overlay sits on a broadcast, not on a page, so it must
          not follow the owner's light or dark preference. */}
      {/* A metric with no number keeps its icon and shows a dash: vanishing
          would move the layout the streamer arranged, and a zero would be a
          claim nobody made. */}
      {metric && (
        <div
          className="flex shrink-0 items-center gap-2.5 leading-none"
          data-testid="message-banner-metric"
        >
          <BannerIcon name={metric.icon} color={metric.color} />
          <span className="text-[38px] font-bold tabular-nums tracking-tight">
            {value === null ? "—" : value.toLocaleString("en-US")}
          </span>
        </div>
      )}
    </div>
  );
}

// The strip's own backing and type, drawn once and statically, so the editor
// judges a message on the surface it will appear on rather than on a form.
export function MessageBannerPreview({
  text,
  align,
  metric,
  value,
  children,
}: {
  text: string;
  align: StripAlign;
  metric?: StripMetric;
  value: number | null;
  // The editor passes its own editable element in place of the drawn text, so
  // the surface being typed into is this one rather than a copy of it.
  children?: React.ReactNode;
}) {
  return (
    <div
      style={
        {
          width: STRIP_WIDTH,
          "--overlay-surface-alpha": OVERLAY_SURFACE_ALPHA.messageBanner,
        } as React.CSSProperties
      }
      className="overlay-surface rounded-2xl border border-white px-6 py-3 text-white shadow-lg"
    >
      <div className="overflow-hidden" style={{ height: OVERLAY_MESSAGE_ROW_H }}>
        {children ?? (
          <MessageBannerRow text={text} align={align} metric={metric} value={value} />
        )}
      </div>
    </div>
  );
}

export const MESSAGE_BANNER_WIDTH = STRIP_WIDTH;
// Backing plus border plus one row: what the preview occupies before scaling.
export const MESSAGE_BANNER_HEIGHT = OVERLAY_MESSAGE_ROW_H + 26;

// A wide, short banner rather than a stacked card: the strip competes for
// vertical space with the goals, the ladder and the highlight surface on a
// 1080 x 1920 canvas, so it spends the axis it can afford.
//
// No backdrop blur. Blur frosts whatever is behind the strip, which reads as a
// solid panel however far the opacity is wound down — it defeated the control
// rather than obeying it. The backing is black alone, scaled by the slider.
export function MessageBanner({
  metrics,
  messages,
}: {
  metrics: BannerMetricValues;
  messages?: StripMessage[];
}) {
  // A metric the message did not ask for, or one with no number behind it right
  // now, draws nothing at all.
  const valueFor = (m: StripMessage) =>
    m.metric ? metrics[m.metric.kind] ?? null : null;

  // A message added in Settings but not yet written is not a blank slot in the
  // cycle: a strip that goes empty for a dwell is a strip that looks broken.
  const written = (messages ?? []).filter((m) => m.text.trim() !== "");
  const list: StripMessage[] = written.length
    ? written
    : [{ text: DEFAULT_MEMBER_MESSAGE, align: "left" }];
  // The message showing, the one leaving, and a tick that restarts the
  // animation on every advance rather than only the first.
  const [cycle, setCycle] = useState({
    index: 0,
    leaving: null as number | null,
    tick: 0,
  });

  // A single message means no stack, no animation and no timer. The list is
  // read through its length so deleting a message stops the timer too.
  const messageCount = list.length;
  const cycles = messageCount > 1;
  useEffect(() => {
    if (!cycles) return;
    const timer = setInterval(() => {
      setCycle((c) => ({
        index: (c.index + 1) % messageCount,
        leaving: c.index,
        tick: c.tick + 1,
      }));
    }, OVERLAY_MESSAGE_DWELL_MS);
    return () => clearInterval(timer);
  }, [cycles, messageCount]);

  // An edit that shortens the list must not leave the strip pointing past its
  // end, which would blank the strip on air until the next advance.
  const showing = cycle.index < list.length ? cycle.index : 0;
  const leaving =
    cycles && cycle.leaving !== null && cycle.leaving < list.length
      ? cycle.leaving
      : null;

  return (
    <div
      style={
        {
          width: STRIP_WIDTH,
          "--overlay-surface-alpha": OVERLAY_SURFACE_ALPHA.messageBanner,
        } as React.CSSProperties
      }
      className="overlay-surface rounded-2xl border border-white px-6 py-3 text-white shadow-lg"
    >
      {/* A fixed-height window: the strip's height never depends on which
          message is showing, or on one being mid-flight. */}
      <div
        className="relative overflow-hidden"
        style={{ height: OVERLAY_MESSAGE_ROW_H }}
        data-testid="message-banner-window"
      >
        {leaving !== null && (
          <MessageBannerRow
            key={`out-${cycle.tick}`}
            text={list[leaving].text}
            align={list[leaving].align}
            metric={list[leaving].metric}
            value={valueFor(list[leaving])}
            className="absolute inset-x-0 top-0"
            data-testid="message-banner-leaving"
            style={{
              animation: `overlay-message-out ${OVERLAY_MESSAGE_TRANSITION_MS}ms ease-in-out forwards`,
            }}
          />
        )}
        <MessageBannerRow
          key={`in-${cycle.tick}`}
          text={list[showing].text}
          align={list[showing].align}
          metric={list[showing].metric}
          value={valueFor(list[showing])}
          className="absolute inset-x-0 top-0"
          data-testid="message-banner-showing"
          style={
            leaving !== null
              ? {
                  animation: `overlay-message-in ${OVERLAY_MESSAGE_TRANSITION_MS}ms ease-in-out forwards`,
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
