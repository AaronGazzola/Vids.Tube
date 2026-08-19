"use client";

import { CustomToast } from "@/components/CustomToast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { applyReusedSettings } from "@/lib/settings-reuse";
import { vodAssetUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import {
  MESSAGE_BANNER_HEIGHT,
  MESSAGE_BANNER_WIDTH,
  MessageBannerPreview,
  MessageBannerRow,
} from "@/components/overlay/message-banner";
import { GOAL_METRICS } from "@/app/layout.types";
import {
  OVERLAY_MESSAGE_DWELL_MAX_MS,
  OVERLAY_MESSAGE_DWELL_MIN_MS,
  OVERLAY_MESSAGE_MAX_VISIBLE,
} from "@/lib/demo-overlay";
import { parseOverlayMessage, visibleLength } from "@/lib/overlay-markup";
import { serializeOverlayMessage } from "@/lib/overlay-markup-serialize";
import {
  applyColor,
  applyMark,
  markIsActive,
  type RunMark,
} from "@/lib/overlay-runs";
import { MessageBannerField } from "./message-banner-field";
import { ColourPicker } from "./colour-picker";
import { useBannerMetricValues } from "./banner-metrics.hooks";
import { TaskListEditor } from "./task-list-editor";
import { useCarryPreviousTasks, useTaskDraftPending } from "./tasks.hooks";
import type { BannerMetricValues } from "@/lib/banner-metrics";
import {
  AlignCenter,
  AlignLeft,
  Bold,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  EyeOff,
  Italic,
  RefreshCw,
  Underline,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useDemoLayoutStore } from "./demo.stores";
import {
  BANNER_ICON_NAMES,
  BANNER_METRIC_KINDS,
  BANNER_METRIC_LABELS,
  type BannerIconName,
  type BannerMetricKind,
  type StripMessage,
} from "./demo.types";
import { toast } from "sonner";
import {
  useBroadcastSettingsFor,
  useOutstandingRepairs,
  useRegenerateStreamKey,
  useReusableBroadcasts,
  useStreamKey,
} from "./broadcast.hooks";
import {
  useChannelCommandsAdmin,
  useCreateCustomCommand,
  useDeleteCustomCommand,
  useUpdateCustomCommand,
} from "./commands.hooks";
import {
  useChannelProjects,
  useCreateProject,
  useDeleteProject,
  useUpdateProject,
} from "./projects.hooks";
import { useOverlayUrlInfo, useRegenerateOverlayToken } from "./demo.hooks";

const STREAM_HOST = process.env.NEXT_PUBLIC_STREAM_HOST ?? "";

export const THUMB_ACCEPT = "image/jpeg,image/png,image/webp";
const MAX_THUMB_BYTES = 5 * 1024 * 1024;

// Checked here rather than only on upload, so a bad file is refused before it
// is staged and the owner is told at the moment they choose it.
export function thumbnailRejection(file: File): string | null {
  if (!THUMB_ACCEPT.split(",").includes(file.type)) {
    return "Unsupported file type — use JPG, PNG, or WebP.";
  }
  if (file.size > MAX_THUMB_BYTES) {
    return "File too large — thumbnail must be 5 MB or smaller.";
  }
  return null;
}

export type SettingsForm = {
  title: string;
  description: string;
  scheduledLocal: string;
  youtubeUrl: string;
  goals: { subs: string; likes: string; viewers: string };
  scoringEnabled: boolean;
  banMode: "suggest" | "auto";
  ttsMode: "suggest" | "auto";
  ttsStability: string;
  ttsSimilarity: string;
  askMode: "suggest" | "auto";
  bridgeEnabled: boolean;
  greetReturning: boolean;
  highlightingEnabled: boolean;
  usefulInfoEnabled: boolean;
  competitionStatusEnabled: boolean;
  progressUpdateEnabled: boolean;
  wrapupMvpEnabled: boolean;
  wrapupSummaryEnabled: boolean;
  wrapupThanksEnabled: boolean;
  autoDisplayFeatured: boolean;
  waitingRoomChat: boolean;
  chatterEnrichment: boolean;
  disabledCommands: string[];
  // The stored key, and a file chosen but not yet uploaded. Staging the file
  // here is what lets Save changes be the only writer.
  thumbnailPath: string | null;
  thumbnailFile: File | null;
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 rounded-lg border p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      {children}
    </section>
  );
}

function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <Label className="text-sm">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-label={label}
      />
    </div>
  );
}

function CopyRow({
  label,
  url,
  dimensions,
}: {
  label: string;
  url: string;
  dimensions: string;
}) {
  const copy = async () => {
    await navigator.clipboard.writeText(url);
    toast.custom(() => (
      <CustomToast
        variant="success"
        title="Copied"
        message={`${label} overlay URL copied.`}
      />
    ));
  };
  return (
    <div className="space-y-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <Input readOnly value={url} aria-label={`${label} overlay URL`} className="h-8 text-xs" />
        <Button
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={copy}
          aria-label={`Copy ${label} overlay URL`}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      <span className="block text-[10px] text-muted-foreground">Add in OBS at {dimensions}</span>
    </div>
  );
}

function ConnectionSection() {
  const { data, isPending } = useStreamKey();
  const regenerate = useRegenerateStreamKey();
  const [revealed, setRevealed] = useState(false);

  const rtmpHost = STREAM_HOST.replace(/^https?:\/\//, "") || "stream.vids.tube";
  const rtmpUrl = `rtmp://${rtmpHost}:1935`;
  const key = data?.key ?? "";
  const channelSlug = data?.channelSlug ?? "";
  const obsKey = key ? `${channelSlug}?key=${key}` : "";
  const keyValue = obsKey ? (revealed ? obsKey : `${channelSlug}?key=${"•".repeat(20)}`) : "";

  const copyKey = async () => {
    if (!obsKey) return;
    await navigator.clipboard.writeText(obsKey);
    toast.custom(() => (
      <CustomToast variant="success" title="Stream key copied" message="Paste it into OBS." />
    ));
  };

  return (
    <Section title="Connection">
      <div className="space-y-2">
        <Label htmlFor="ingest">Server (RTMP URL)</Label>
        <Input id="ingest" readOnly value={rtmpUrl} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="key">Stream key</Label>
        {isPending ? (
          <Skeleton className="h-9 w-full" />
        ) : (
          <div className="flex gap-2">
            <Input id="key" readOnly value={keyValue} />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setRevealed((v) => !v)}
              aria-label={revealed ? "Hide stream key" : "Show stream key"}
            >
              {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button type="button" variant="outline" size="icon" onClick={copyKey} aria-label="Copy stream key">
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" disabled={regenerate.isPending}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate key
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate stream key?</AlertDialogTitle>
            <AlertDialogDescription>
              The current key stops working immediately. Update OBS with the new key before streaming again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => regenerate.mutate()}>Regenerate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Section>
  );
}

type ProjectDialogState = {
  id: string | null;
  name: string;
  blurb: string;
  domainUrl: string;
  repoUrl: string;
};

const EMPTY_PROJECT_DIALOG: ProjectDialogState = {
  id: null,
  name: "",
  blurb: "",
  domainUrl: "",
  repoUrl: "",
};

function ProjectsSection() {
  const { data: projects, isPending } = useChannelProjects();
  const create = useCreateProject();
  const update = useUpdateProject();
  const remove = useDeleteProject();
  const [dialog, setDialog] = useState<ProjectDialogState | null>(null);

  const submit = () => {
    if (!dialog) return;
    const input = {
      name: dialog.name,
      blurb: dialog.blurb,
      domainUrl: dialog.domainUrl,
      repoUrl: dialog.repoUrl,
    };
    const done = { onSuccess: () => setDialog(null) };
    if (dialog.id) {
      update.mutate({ id: dialog.id, input }, done);
    } else {
      create.mutate(input, done);
    }
  };

  return (
    <Section title="Projects">
      <p className="text-xs text-muted-foreground">
        What you&apos;re building — used by progress updates, the wrap-up
        message, and !ask answers (links included).
      </p>
      {isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : (projects ?? []).length === 0 ? (
        <p className="text-xs text-muted-foreground">No projects yet.</p>
      ) : (
        <ul className="divide-y rounded-md border">
          {(projects ?? []).map((p) => (
            <li key={p.id} className="flex items-center gap-3 p-2.5 text-sm">
              <div className="min-w-0 flex-1">
                <span className="font-medium">{p.name}</span>
                {p.blurb && (
                  <span className="text-muted-foreground"> — {p.blurb}</span>
                )}
                <span className="block truncate text-xs text-muted-foreground">
                  {[p.domainUrl, p.repoUrl].filter(Boolean).join(" · ")}
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs"
                onClick={() =>
                  setDialog({
                    id: p.id,
                    name: p.name,
                    blurb: p.blurb ?? "",
                    domainUrl: p.domainUrl ?? "",
                    repoUrl: p.repoUrl ?? "",
                  })
                }
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-2 text-xs text-destructive"
                disabled={remove.isPending}
                onClick={() => remove.mutate(p.id)}
              >
                Delete
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => setDialog(EMPTY_PROJECT_DIALOG)}
      >
        Add project
      </Button>
      {dialog && (
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-medium">
            {dialog.id ? `Edit ${dialog.name}` : "New project"}
          </p>
          <div className="space-y-2">
            <Label htmlFor="proj-name">Name</Label>
            <Input
              id="proj-name"
              value={dialog.name}
              onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
              placeholder="Vids.Tube"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-blurb">Blurb</Label>
            <Input
              id="proj-blurb"
              value={dialog.blurb}
              onChange={(e) => setDialog({ ...dialog, blurb: e.target.value })}
              placeholder="A community-driven YouTube alternative"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-domain">Domain URL</Label>
            <Input
              id="proj-domain"
              value={dialog.domainUrl}
              onChange={(e) =>
                setDialog({ ...dialog, domainUrl: e.target.value })
              }
              placeholder="https://vids.tube"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="proj-repo">Repo URL</Label>
            <Input
              id="proj-repo"
              value={dialog.repoUrl}
              onChange={(e) =>
                setDialog({ ...dialog, repoUrl: e.target.value })
              }
              placeholder="https://github.com/you/repo"
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={create.isPending || update.isPending}
              onClick={submit}
            >
              {dialog.id ? "Save project" : "Add project"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

// The overlay strip is 810 wide; the settings column is not. The preview is the
// real strip, scaled, so what is judged is the surface the message lands on.
const MESSAGE_PREVIEW_SCALE = 0.42;


function MessageEditor({
  message,
  position,
  total,
  metricValues,
  border,
  onChange,
  onRemove,
  onMove,
}: {
  message: StripMessage;
  position: number;
  total: number;
  metricValues: BannerMetricValues;
  border: boolean;
  onChange: (next: StripMessage) => void;
  onRemove: () => void;
  onMove: (by: -1 | 1) => void;
}) {
  const value = message.text;
  const [refused, setRefused] = useState(false);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const remaining = OVERLAY_MESSAGE_MAX_VISIBLE - visibleLength(value);

  const commit = (next: string) => {
    if (visibleLength(next) > OVERLAY_MESSAGE_MAX_VISIBLE) {
      setRefused(true);
      return;
    }
    setRefused(false);
    onChange({ ...message, text: next });
  };

  // Styling works on the run list rather than on the characters, so a control
  // toggles what is selected instead of inserting punctuation the streamer then
  // has to look at.
  const runs = parseOverlayMessage(value);
  const toggle = (mark: RunMark) => {
    const active = markIsActive(runs, selection.start, selection.end, mark);
    commit(
      serializeOverlayMessage(
        applyMark(runs, selection.start, selection.end, mark, !active)
      )
    );
  };

  const [textColour, setTextColour] = useState("#ffcc00");

  const markButton = (
    label: string,
    icon: React.ReactNode,
    mark: RunMark
  ) => (
    <Button
      type="button"
      size="icon"
      variant="outline"
      className="h-7 w-7"
      aria-label={label}
      // Keep the caret where it is: a button that takes focus first loses the
      // selection it was meant to wrap.
      aria-pressed={markIsActive(runs, selection.start, selection.end, mark)}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => toggle(mark)}
    >
      {icon}
    </Button>
  );

  return (
    <li className="space-y-2 p-2.5">
      <div className="flex items-center gap-2">
        <span className="w-5 shrink-0 text-xs text-muted-foreground">
          {position + 1}
        </span>
        <span className="flex-1 text-xs text-muted-foreground">
          Type into the banner below.
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pl-7">
        {markButton("Bold", <Bold className="h-3.5 w-3.5" />, "bold")}
        {markButton("Italic", <Italic className="h-3.5 w-3.5" />, "italic")}
        {markButton(
          "Underline",
          <Underline className="h-3.5 w-3.5" />,
          "underline"
        )}
        <ColourPicker
          value={textColour}
          label={`Colour for message ${position + 1}`}
          onChange={(colour) => {
            setTextColour(colour);
            commit(
              serializeOverlayMessage(
                applyColor(runs, selection.start, selection.end, colour)
              )
            );
          }}
        />
        {/* Alignment belongs to the whole line rather than to a selection, so
            it toggles the message instead of wrapping anything. */}
        <Button
          type="button"
          size="icon"
          variant={message.align === "center" ? "secondary" : "outline"}
          className="h-7 w-7"
          aria-label={`Centre message ${position + 1}`}
          aria-pressed={message.align === "center"}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            onChange({
              ...message,
              align: message.align === "center" ? "left" : "center",
            })
          }
        >
          {message.align === "center" ? (
            <AlignCenter className="h-3.5 w-3.5" />
          ) : (
            <AlignLeft className="h-3.5 w-3.5" />
          )}
        </Button>
        <span className="ml-1 text-xs text-muted-foreground">
          {remaining} left
        </span>
        <span className="flex-1" />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={`Move message ${position + 1} up`}
          disabled={position === 0}
          onClick={() => onMove(-1)}
        >
          <ChevronUp className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          aria-label={`Move message ${position + 1} down`}
          disabled={position === total - 1}
          onClick={() => onMove(1)}
        >
          <ChevronDown className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-xs text-destructive"
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
      {/* Empty means "follow the banner's time", which is why the placeholder
          says so rather than showing the global's number: a field pre-filled
          with 6 would look identical to one deliberately set to 6, and changing
          the global would then appear to do nothing. */}
      <div className="flex flex-wrap items-center gap-2 pl-7 text-xs">
        <label className="flex items-center gap-2">
          Show for
          <DisplayTimeInput
            seconds={
              message.dwellMs === undefined ? null : message.dwellMs / 1000
            }
            placeholder="default"
            label={`Seconds message ${position + 1} shows for`}
            onCommit={(ms) => onChange({ ...message, dwellMs: ms })}
            onClear={() => {
              // Deleted rather than set to undefined: "follows the banner's
              // time" has to survive a save as an absent key.
              const rest = { ...message };
              delete rest.dwellMs;
              onChange(rest);
            }}
          />
          seconds
        </label>
        {message.dwellMs === undefined && (
          <span className="text-muted-foreground">
            follows the banner&apos;s time
          </span>
        )}
      </div>
      {/* The metric is set from here rather than typed into the banner: a
          number pulled live is not something to type over. */}
      <div className="flex flex-wrap items-center gap-2 pl-7 text-xs">
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            aria-label={`Show a metric on message ${position + 1}`}
            checked={!!message.metric}
            onChange={(e) =>
              onChange({
                ...message,
                metric: e.target.checked
                  ? { kind: "members", icon: "logo", color: "#ffffff" }
                  : undefined,
              })
            }
          />
          Show a metric
        </label>
        {message.metric && (
          <>
            <select
              aria-label={`Metric for message ${position + 1}`}
              className="h-7 rounded-md border bg-background px-1.5"
              value={message.metric.kind}
              onChange={(e) =>
                onChange({
                  ...message,
                  metric: {
                    ...message.metric!,
                    kind: e.target.value as BannerMetricKind,
                  },
                })
              }
            >
              {BANNER_METRIC_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {BANNER_METRIC_LABELS[kind]}
                </option>
              ))}
            </select>
            <select
              aria-label={`Icon for message ${position + 1}`}
              className="h-7 rounded-md border bg-background px-1.5 capitalize"
              value={message.metric.icon}
              onChange={(e) =>
                onChange({
                  ...message,
                  metric: {
                    ...message.metric!,
                    icon: e.target.value as BannerIconName,
                  },
                })
              }
            >
              {BANNER_ICON_NAMES.map((icon) => (
                <option key={icon} value={icon}>
                  {icon === "logo" ? "Vids.Tube logo" : icon}
                </option>
              ))}
            </select>
            <ColourPicker
              value={message.metric.color}
              label={`Icon colour for message ${position + 1}`}
              onChange={(colour) =>
                onChange({
                  ...message,
                  metric: { ...message.metric!, color: colour },
                })
              }
            />
          </>
        )}
      </div>
      {refused && (
        <p className="pl-7 text-xs text-destructive">
          Messages are limited to {OVERLAY_MESSAGE_MAX_VISIBLE} visible
          characters, so the strip never overflows on air. Formatting does not
          count.
        </p>
      )}
      {/* The banner is the field. There is no copy of it to compare against,
          because the thing being typed into is the thing that goes on air. */}
      <div
        className="ml-7 overflow-hidden rounded-md"
        style={{
          width: MESSAGE_BANNER_WIDTH * MESSAGE_PREVIEW_SCALE,
          height: MESSAGE_BANNER_HEIGHT * MESSAGE_PREVIEW_SCALE,
          maxWidth: "100%",
        }}
      >
        <div
          style={{
            transform: `scale(${MESSAGE_PREVIEW_SCALE})`,
            transformOrigin: "top left",
          }}
        >
          <MessageBannerPreview
            text={value}
            align={message.align}
            metric={message.metric}
            value={message.metric ? metricValues[message.metric.kind] : null}
            border={border}
          >
            <MessageBannerRow
              align={message.align}
              metric={message.metric}
              value={
                message.metric ? metricValues[message.metric.kind] : null
              }
            >
              <MessageBannerField
                value={value}
                onChange={commit}
                onSelectionChange={setSelection}
                ariaLabel={`Message ${position + 1}`}
                className="min-w-0 flex-1 overflow-hidden whitespace-nowrap text-[32px] font-semibold leading-[1.15] outline-none"
                style={message.align === "center" ? { textAlign: "center" } : undefined}
              />
            </MessageBannerRow>
          </MessageBannerPreview>
        </div>
      </div>
    </li>
  );
}

// Seconds in, milliseconds out. The streamer thinks in seconds; everything
// below the editor is in milliseconds because the timer is.
function DisplayTimeInput({
  seconds,
  placeholder,
  label,
  onCommit,
  onClear,
}: {
  seconds: number | null;
  placeholder: string;
  label: string;
  onCommit: (ms: number) => void;
  onClear?: () => void;
}) {
  // Typed locally and only handed on when it is a number the banner can honour,
  // so a half-typed "1" on the way to "12" never reaches a live broadcast.
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (seconds === null ? "" : String(seconds));

  const commit = (raw: string) => {
    setDraft(null);
    if (!raw.trim()) {
      onClear?.();
      return;
    }
    const ms = Math.round(Number(raw) * 1000);
    if (!Number.isFinite(ms)) return;
    if (ms < OVERLAY_MESSAGE_DWELL_MIN_MS || ms > OVERLAY_MESSAGE_DWELL_MAX_MS) {
      return;
    }
    onCommit(ms);
  };

  return (
    <input
      type="number"
      inputMode="decimal"
      min={OVERLAY_MESSAGE_DWELL_MIN_MS / 1000}
      max={OVERLAY_MESSAGE_DWELL_MAX_MS / 1000}
      step="0.5"
      aria-label={label}
      placeholder={placeholder}
      className="h-7 w-20 rounded-md border bg-background px-1.5 text-xs"
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
    />
  );
}

// What the overlay says when each goal's number goes up. Beside the targets,
// because the target and the announcement are two halves of what a goal means.
function GoalRiseMessages() {
  const messages = useDemoLayoutStore((s) => s.config.goalRiseMessages);
  const setMessage = useDemoLayoutStore((s) => s.setGoalRiseMessage);

  return (
    <div className="space-y-2 border-t pt-3">
      <p className="text-xs text-muted-foreground">
        Shown across the middle of the stream when the number goes up, before it
        flies to the goal. Subs and likes show the increase; viewers show the
        current total. Leave one empty for the icon and number alone.
      </p>
      {GOAL_METRICS.map((m) => (
        <label key={m} className="flex items-center gap-2 text-xs">
          <span className="w-16 shrink-0 capitalize text-muted-foreground">
            {m}
          </span>
          <Input
            value={messages[m] ?? ""}
            onChange={(e) => setMessage(m, e.target.value)}
            aria-label={`${m} increment message`}
            className="h-8 text-sm"
          />
        </label>
      ))}
    </div>
  );
}

export function MessagesSection({ channelSlug }: { channelSlug: string }) {
  const metricValues = useBannerMetricValues(channelSlug);
  const bannerDwellMs = useDemoLayoutStore((s) => s.config.bannerDwellMs);
  const bannerBorder = useDemoLayoutStore((s) => s.config.bannerBorder);
  const setBannerDwellMs = useDemoLayoutStore((s) => s.setBannerDwellMs);
  const setBannerBorder = useDemoLayoutStore((s) => s.setBannerBorder);
  // The draft, not the saved list: nothing typed here reaches the overlay or
  // the database until Save changes is pressed in the toolbar.
  const messages = useDemoLayoutStore((s) => s.draftMessages);
  const setMessages = useDemoLayoutStore((s) => s.setDraftMessages);
  const saved = useDemoLayoutStore((s) => s.config.messages);
  const pending = JSON.stringify(messages) !== JSON.stringify(saved);

  const replace = (index: number, next: StripMessage) =>
    setMessages(messages.map((m, i) => (i === index ? next : m)));

  const move = (index: number, by: -1 | 1) => {
    const to = index + by;
    if (to < 0 || to >= messages.length) return;
    const next = [...messages];
    [next[index], next[to]] = [next[to], next[index]];
    setMessages(next);
  };

  return (
    <Section title="Overlay messages">
      <p className="text-xs text-muted-foreground">
        The members strip cycles through these, showing the member count beside
        the first one only. A single message does not cycle.
      </p>
      {/* Settings for the banner itself rather than for any one message, so they
          sit above the list rather than inside a row of it. */}
      <div className="flex flex-wrap items-center gap-4 rounded-md border px-3 py-2 text-xs">
        <label className="flex items-center gap-2">
          Show each message for
          <DisplayTimeInput
            seconds={bannerDwellMs / 1000}
            placeholder=""
            label="Seconds each message shows for"
            onCommit={setBannerDwellMs}
          />
          seconds
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            aria-label="Draw a border around the message banner"
            checked={bannerBorder}
            onChange={(e) => setBannerBorder(e.target.checked)}
          />
          Border
        </label>
      </div>
      <ul className="divide-y rounded-md border">
        {messages.map((message, i) => (
          <MessageEditor
            key={i}
            message={message}
            position={i}
            metricValues={metricValues}
            total={messages.length}
            border={bannerBorder}
            onChange={(next) => replace(i, next)}
            onRemove={() => setMessages(messages.filter((_, j) => j !== i))}
            onMove={(by) => move(i, by)}
          />
        ))}
      </ul>
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            setMessages([...messages, { text: "", align: "left" }])
          }
        >
          Add message
        </Button>
        {pending && (
          <span className="text-xs text-muted-foreground">
            Not on the overlay yet — press Save changes.
          </span>
        )}
      </div>
    </Section>
  );
}

function TasksSection({ streamId }: { streamId: string | null }) {
  const carry = useCarryPreviousTasks(streamId);
  const pending = useTaskDraftPending(streamId);

  return (
    <Section title="Tasks">
      <p className="text-xs text-muted-foreground">
        What is being worked on this broadcast. The list is shown on the overlay
        when it changes, and can be edited during the broadcast from the
        Activity tab.
      </p>
      <TaskListEditor />
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          disabled={!streamId || carry.isPending}
          onClick={() => carry.mutate()}
        >
          Carry over unfinished tasks
        </Button>
        {pending && (
          <span className="text-xs text-muted-foreground">
            Not saved yet — press Save changes.
          </span>
        )}
      </div>
    </Section>
  );
}

type CommandDialogState = {
  id: string | null;
  keyword: string;
  description: string;
  response: string;
  cooldownS: string;
};

const EMPTY_COMMAND_DIALOG: CommandDialogState = {
  id: null,
  keyword: "",
  description: "",
  response: "",
  cooldownS: "30",
};

function ChatCommandsSection({
  form,
  set,
  channelSlug,
  workerRunning,
}: {
  form: SettingsForm;
  set: (patch: Partial<SettingsForm>) => void;
  channelSlug: string;
  workerRunning: boolean;
}) {
  const { data: commands, isPending } = useChannelCommandsAdmin();
  const create = useCreateCustomCommand();
  const update = useUpdateCustomCommand();
  const remove = useDeleteCustomCommand();
  const [dialog, setDialog] = useState<CommandDialogState | null>(null);

  const toggleStream = (keyword: string, included: boolean) => {
    const withoutKeyword = form.disabledCommands.filter((k) => k !== keyword);
    set({
      disabledCommands: included
        ? withoutKeyword
        : [...withoutKeyword, keyword].sort(),
    });
  };

  const submitDialog = () => {
    if (!dialog) return;
    const input = {
      keyword: dialog.keyword,
      description: dialog.description,
      response: dialog.response,
      cooldownS: Number(dialog.cooldownS) || 0,
    };
    const done = { onSuccess: () => setDialog(null) };
    if (dialog.id) {
      update.mutate({ id: dialog.id, input }, done);
    } else {
      create.mutate(input, done);
    }
  };

  return (
    <Section title="Chat commands">
      <p className="text-xs text-muted-foreground">
        Viewers can type these in chat (both platforms). Checkboxes choose which
        commands run on this stream — saved with Save changes. Commands need the
        local worker{" "}
        <span
          className={cn(
            "font-medium",
            workerRunning ? "text-green-600" : "text-amber-600"
          )}
        >
          ({workerRunning ? "running" : "stopped"})
        </span>
        . Public guide: /{channelSlug}/commands
      </p>
      {isPending ? (
        <Skeleton className="h-24 w-full" />
      ) : (
        <ul className="divide-y rounded-md border">
          {(commands ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-3 p-2.5">
              <input
                type="checkbox"
                className="h-4 w-4 accent-primary"
                checked={!form.disabledCommands.includes(c.keyword)}
                onChange={(e) => toggleStream(c.keyword, e.target.checked)}
                aria-label={`Include !${c.keyword} on this stream`}
              />
              <code className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-xs font-semibold">
                !{c.keyword}
              </code>
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                {c.description}
              </span>
              {c.kind === "custom" && (
                <span className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs"
                    onClick={() =>
                      setDialog({
                        id: c.id,
                        keyword: c.keyword,
                        description: c.description,
                        response: c.response ?? "",
                        cooldownS: String(c.cooldownS),
                      })
                    }
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-xs text-destructive"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(c.id)}
                  >
                    Delete
                  </Button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={() => setDialog(EMPTY_COMMAND_DIALOG)}
      >
        Add command
      </Button>
      {dialog && (
        <div className="space-y-3 rounded-md border p-3">
          <p className="text-sm font-medium">
            {dialog.id ? `Edit !${dialog.keyword}` : "New command"}
          </p>
          <div className="space-y-2">
            <Label htmlFor="cmd-keyword">Keyword</Label>
            <Input
              id="cmd-keyword"
              value={dialog.keyword}
              onChange={(e) => setDialog({ ...dialog, keyword: e.target.value })}
              placeholder="pc"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cmd-description">Description</Label>
            <Input
              id="cmd-description"
              value={dialog.description}
              onChange={(e) =>
                setDialog({ ...dialog, description: e.target.value })
              }
              placeholder="What rig I stream on"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cmd-response">Response</Label>
            <Textarea
              id="cmd-response"
              value={dialog.response}
              onChange={(e) =>
                setDialog({ ...dialog, response: e.target.value })
              }
              placeholder="The bot replies with this text."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cmd-cooldown">Cooldown (seconds)</Label>
            <Input
              id="cmd-cooldown"
              type="number"
              min={0}
              value={dialog.cooldownS}
              onChange={(e) =>
                setDialog({ ...dialog, cooldownS: e.target.value })
              }
            />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              disabled={create.isPending || update.isPending}
              onClick={submitDialog}
            >
              {dialog.id ? "Save command" : "Add command"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setDialog(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Section>
  );
}

function RepairSection() {
  const { data, isPending } = useOutstandingRepairs();

  return (
    <Section title="Post-broadcast repair">
      {isPending ? (
        <Skeleton className="h-4 w-56" />
      ) : data?.count ? (
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          <span className="text-sm">
            {data.count} broadcast{data.count === 1 ? "" : "s"} waiting to be
            repaired
            {data.endedAt
              ? `, latest ${new Date(data.endedAt).toLocaleDateString()}`
              : ""}
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
          <span className="text-sm">Nothing waiting</span>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Saving the YouTube chat log, scoring it, and rebuilding memberships and
        credits runs separately from the worker, because it rewrites the same
        rows a live broadcast writes. Run it after a broadcast ends:
      </p>
      <code className="block rounded bg-muted px-2 py-1 font-mono text-xs">
        npm run repair
      </code>
    </Section>
  );
}

export function SettingsTab({
  form,
  setForm,
  channelSlug,
  streamId,
  thumbnailPath,
  isPublic,
  workerRunning,
  chatCapture,
}: {
  form: SettingsForm;
  setForm: (f: SettingsForm) => void;
  channelSlug: string;
  streamId: string | null;
  thumbnailPath: string | null;
  isPublic: boolean;
  workerRunning: boolean;
  chatCapture: "working" | "stalled" | null;
}) {
  const urlInfo = useOverlayUrlInfo();
  const regenerateToken = useRegenerateOverlayToken();
  const [thumbnailError, setThumbnailError] = useState<string | null>(null);

  // A staged file is previewed from a local object URL, revoked when it is
  // replaced or the tab unmounts, so nothing has to reach storage to be seen.
  const stagedUrl = useMemo(
    () => (form.thumbnailFile ? URL.createObjectURL(form.thumbnailFile) : null),
    [form.thumbnailFile]
  );
  useEffect(
    () => () => {
      if (stagedUrl) URL.revokeObjectURL(stagedUrl);
    },
    [stagedUrl]
  );
  const thumbnailUrl = stagedUrl ?? vodAssetUrl(form.thumbnailPath ?? thumbnailPath);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const overlayUrl = urlInfo.data
    ? `${origin}/overlay/${channelSlug}?token=${urlInfo.data.token}`
    : null;

  const set = (patch: Partial<SettingsForm>) => setForm({ ...form, ...patch });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <ReuseSettingsDialog form={form} setForm={setForm} isLive={isPublic} />

      <Section title="Broadcast details">
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={form.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="What's this stream about?"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={form.description}
            onChange={(e) => set({ description: e.target.value })}
            placeholder="Optional"
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="schedule">Schedule (optional)</Label>
          <Input
            id="schedule"
            type="datetime-local"
            value={form.scheduledLocal}
            disabled={isPublic}
            onChange={(e) => set({ scheduledLocal: e.target.value })}
          />
          <p className="text-xs text-muted-foreground">
            Set a date for a public waiting room. Leave empty for a private draft.
          </p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="thumbnail">Thumbnail</Label>
          {thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumbnailUrl}
              alt="Broadcast thumbnail"
              className="aspect-video w-full rounded-md object-cover"
            />
          )}
          <Input
            id="thumbnail"
            type="file"
            accept={THUMB_ACCEPT}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null;
              if (!file) return;
              const rejection = thumbnailRejection(file);
              if (rejection) {
                setThumbnailError(rejection);
                e.target.value = "";
                return;
              }
              setThumbnailError(null);
              set({ thumbnailFile: file });
            }}
          />
          {thumbnailError ? (
            <p className="text-xs text-destructive">{thumbnailError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              {form.thumbnailFile
                ? "Chosen. It is stored when you save changes."
                : "JPG, PNG or WebP, up to 5 MB."}
            </p>
          )}
        </div>
      </Section>

      <ConnectionSection />

      <Section title="YouTube broadcast">
        <div className="space-y-2">
          <Label htmlFor="youtube">YouTube stream URL or video id</Label>
          <Input
            id="youtube"
            value={form.youtubeUrl}
            onChange={(e) => set({ youtubeUrl: e.target.value })}
            placeholder="https://youtube.com/watch?v=…"
          />
          <p className="text-xs text-muted-foreground">
            Feeds likes/viewers goals and YouTube chat. Saved with Save changes.
          </p>
        </div>
      </Section>

      <Section title="Goals">
        <div className="grid grid-cols-3 gap-3">
          {(["subs", "likes", "viewers"] as const).map((m) => (
            <label key={m} className="flex flex-col gap-1 text-xs">
              <span className="capitalize text-muted-foreground">{m}</span>
              <Input
                type="number"
                min={0}
                value={form.goals[m]}
                onChange={(e) => set({ goals: { ...form.goals, [m]: e.target.value } })}
                aria-label={`${m} goal`}
                className="h-8 text-sm"
              />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Subs count up from a baseline captured when you schedule or go live. Likes
          and viewers use absolute YouTube values.
        </p>
        <GoalRiseMessages />
      </Section>

      <Section title="OBS overlay">
        <p className="text-xs text-muted-foreground">
          One browser source renders every overlay element. Add it in OBS at
          1080 × 1920 covering the full canvas, then position, scale, and
          toggle each element live from the Preview tab — OBS updates within a
          second.
        </p>
        {overlayUrl ? (
          <CopyRow label="Overlay" url={overlayUrl} dimensions="1080 × 1920 (full canvas)" />
        ) : (
          <Skeleton className="h-14 w-full" />
        )}
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs text-muted-foreground">
            The URL includes a private token. Regenerating it invalidates the
            old URL — update the OBS source after.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="h-8 shrink-0"
            disabled={regenerateToken.isPending}
            onClick={() => regenerateToken.mutate()}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Regenerate
          </Button>
        </div>
      </Section>

      <Section title="Mod bot">
        <SwitchRow
          label="Auto-hide flagged messages"
          description="Always on — the bot hides clearly abusive messages."
          checked
          disabled
        />
        <SwitchRow
          label="Chat scoring"
          description="Score chat, run the leaderboard, and feed the competition."
          checked={form.scoringEnabled}
          onCheckedChange={(v) => set({ scoringEnabled: v })}
        />
        <SwitchRow
          label="Auto-ban (vs suggest)"
          description="On: the bot bans automatically. Off: it only suggests bans."
          checked={form.banMode === "auto"}
          onCheckedChange={(v) => set({ banMode: v ? "auto" : "suggest" })}
        />
        <SwitchRow
          label="Auto-TTS (vs suggest)"
          description="On: moderation-passed !tts requests play without a click. Off: you approve each one."
          checked={form.ttsMode === "auto"}
          onCheckedChange={(v) => set({ ttsMode: v ? "auto" : "suggest" })}
        />
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">TTS voice stability</span>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={form.ttsStability}
              onChange={(e) => set({ ttsStability: e.target.value })}
              aria-label="TTS voice stability"
              className="h-8 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground">TTS voice similarity</span>
            <Input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={form.ttsSimilarity}
              onChange={(e) => set({ ttsSimilarity: e.target.value })}
              aria-label="TTS voice similarity"
              className="h-8 text-sm"
            />
          </label>
        </div>
        <p className="text-xs text-muted-foreground">
          ElevenLabs voice settings (0–1). Higher stability keeps delivery
          steady; lower values can drift or drag syllables. Applies to newly
          synthesized !tts audio.
        </p>
        <SwitchRow
          label="Auto-answer !ask (vs suggest)"
          description="On: grounded answers post without a click. Off: you approve each Q&A."
          checked={form.askMode === "auto"}
          onCheckedChange={(v) => set({ askMode: v ? "auto" : "suggest" })}
        />
        <SwitchRow
          label="Bridge chat to YouTube"
          description="Post vids.tube chat messages into the YouTube live chat via Nightbot."
          checked={form.bridgeEnabled}
          onCheckedChange={(v) => set({ bridgeEnabled: v })}
        />
        <SwitchRow
          label="Welcome returning chatters"
          description="On: someone who has chatted here before gets a personal welcome back on their first message. Off: only first-time chatters are greeted."
          checked={form.greetReturning}
          onCheckedChange={(v) => set({ greetReturning: v })}
        />
        <SwitchRow
          label="Featured highlighting"
          description="The bot features standout messages for the overlay and Read-this."
          checked={form.highlightingEnabled}
          onCheckedChange={(v) => set({ highlightingEnabled: v })}
        />
        <SwitchRow
          label="Auto-display featured"
          description="Push featured messages straight to the overlay without a click."
          checked={form.autoDisplayFeatured}
          onCheckedChange={(v) => set({ autoDisplayFeatured: v })}
          disabled={!form.highlightingEnabled}
        />
      </Section>

      <Section title="Waiting room">
        <SwitchRow
          label="Waiting-room chat"
          description="Let viewers chat on the public scheduled page before you go live."
          checked={form.waitingRoomChat}
          onCheckedChange={(v) => set({ waitingRoomChat: v })}
        />
      </Section>

      <Section title="Chatters">
        <SwitchRow
          label="Fetch chatter profiles immediately"
          description="On: a new chatter's real handle and avatar are fetched the first time they speak. Off: their profile is built from their chat name and filled in after the stream, which never waits on YouTube."
          checked={form.chatterEnrichment}
          onCheckedChange={(v) => set({ chatterEnrichment: v })}
        />
      </Section>

      <ChatCommandsSection
        form={form}
        set={set}
        channelSlug={channelSlug}
        workerRunning={workerRunning}
      />

      <Section title="Bot moments">
        <SwitchRow
          label="Useful info"
          description="When you wonder something aloud the bot confidently knows, it answers in chat."
          checked={form.usefulInfoEnabled}
          onCheckedChange={(v) => set({ usefulInfoEnabled: v })}
        />
        <SwitchRow
          label="Competition status"
          description="Periodic top-three leaderboard updates in chat."
          checked={form.competitionStatusEnabled}
          onCheckedChange={(v) => set({ competitionStatusEnabled: v })}
        />
        <SwitchRow
          label="Progress update"
          description="Periodic reminders of what you're building, with project links."
          checked={form.progressUpdateEnabled}
          onCheckedChange={(v) => set({ progressUpdateEnabled: v })}
        />
        <div className="my-1 h-px bg-border" />
        <p className="text-xs text-muted-foreground">
          Wrap-up messages — sent only when you press Wrap up in the Activity
          tab.
        </p>
        <SwitchRow
          label="MVP announcement"
          description="Celebrate the top chatter of the stream."
          checked={form.wrapupMvpEnabled}
          onCheckedChange={(v) => set({ wrapupMvpEnabled: v })}
        />
        <SwitchRow
          label="Achievement summary"
          description="An AI recap of what got done, from the transcript."
          checked={form.wrapupSummaryEnabled}
          onCheckedChange={(v) => set({ wrapupSummaryEnabled: v })}
        />
        <SwitchRow
          label="Thanks + project links"
          description="A goodbye message pointing viewers at your projects."
          checked={form.wrapupThanksEnabled}
          onCheckedChange={(v) => set({ wrapupThanksEnabled: v })}
        />
      </Section>

      <TasksSection streamId={streamId} />

      <MessagesSection channelSlug={channelSlug} />

      <ProjectsSection />

      <Section title="Local worker">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "h-2.5 w-2.5 rounded-full",
              workerRunning ? "bg-green-500" : "bg-muted-foreground/40"
            )}
          />
          <span className="text-sm">{workerRunning ? "Running" : "Stopped"}</span>
        </div>
        {chatCapture && (
          <div
            className="flex items-center gap-2"
            data-testid="chat-capture-indicator"
            data-state={chatCapture}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 rounded-full",
                chatCapture === "working" ? "bg-green-500" : "bg-red-500"
              )}
            />
            <span className="text-sm">
              YouTube chat capture{" "}
              {chatCapture === "working" ? "working" : "stalled"}
            </span>
          </div>
        )}
        {chatCapture === "stalled" && (
          <p className="text-xs text-red-600">
            No YouTube chat page has been read recently. Messages sent on YouTube
            are not being stored. Restart the worker to resume capture.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Transcription, chat scoring, moderation, and YouTube chat need the local
          worker. Start it with:
        </p>
        <code className="block rounded bg-muted px-2 py-1 font-mono text-xs">npm run worker</code>
      </Section>

      <RepairSection />
    </div>
  );
}

// Copies a previous broadcast into the form and nothing else. Save changes is
// still the only writer, so opening this, browsing it and picking the wrong
// broadcast all cost nothing.
//
// Deliberately not the task list: tasks belong to the broadcast they were worked
// on, and carrying unfinished ones forward is its own button in the Tasks
// section, pressed on purpose.
export function ReuseSettingsDialog({
  form,
  setForm,
  isLive,
}: {
  form: SettingsForm;
  setForm: (f: SettingsForm) => void;
  isLive: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { data: broadcasts, isPending } = useReusableBroadcasts(open);
  const load = useBroadcastSettingsFor();

  const choose = async (streamId: string) => {
    const settings = await load.mutateAsync(streamId);
    setForm(applyReusedSettings(form, settings));
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        className="self-start"
        disabled={isLive}
        onClick={() => setOpen(true)}
      >
        Reuse stream settings
      </Button>
      {isLive && (
        <p className="-mt-2 text-xs text-muted-foreground">
          Not while you are live.
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reuse stream settings</DialogTitle>
            <DialogDescription>
              Copies everything from a previous broadcast except its YouTube URL
              and its scheduled time. Nothing is saved until you click Save
              changes.
            </DialogDescription>
          </DialogHeader>

          {isPending ? (
            <Skeleton className="h-40 w-full" />
          ) : !broadcasts?.length ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No previous broadcasts yet.
            </p>
          ) : (
            <ul className="space-y-2">
              {broadcasts.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => void choose(b.id)}
                    disabled={load.isPending}
                    className="flex w-full items-center gap-3 rounded-md border p-2 text-left hover:bg-accent disabled:opacity-50"
                  >
                    {b.thumbnailPath ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={vodAssetUrl(b.thumbnailPath) ?? ""}
                        alt=""
                        className="aspect-video w-28 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex aspect-video w-28 shrink-0 items-center justify-center rounded bg-muted text-[10px] text-muted-foreground">
                        No thumbnail
                      </div>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {b.title}
                      </span>
                      {b.startedAt && (
                        <span className="block text-xs text-muted-foreground">
                          {new Date(b.startedAt).toLocaleDateString()}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
