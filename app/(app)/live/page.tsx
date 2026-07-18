"use client";

import { useRequireOwner, useWaitingCount } from "@/app/layout.hooks";
import { DisconnectedOverlay } from "@/components/live-stage";
import { LivePlayer } from "@/components/live-player";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  evaluateScheduleSave,
  type ScheduleSaveCheck,
} from "@/lib/schedule-validation";
import { isFeedDisconnected } from "@/lib/stream";
import { useStickyScroll } from "@/lib/use-sticky-scroll";
import { ExternalLink, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";
import { DemoActivity } from "./demo-activity";
import { DemoPreviewStage } from "./demo-preview";
import { useDemoController, useDemoLayout } from "./demo.hooks";
import { useDemoLayoutStore } from "./demo.stores";
import { ActivityContent } from "./panels";
import { SettingsTab, type SettingsForm } from "./settings-tab";
import {
  useCurrentBroadcast,
  useDiscardBroadcast,
  useEndStream,
  useGoLive,
  useSaveStreamSettings,
  useStreamSettings,
  useTranscript,
} from "./broadcast.hooks";
import type { StreamSettings } from "./broadcast.actions";
import type { Stream } from "@/app/layout.types";

type StreamState = "none" | "draft" | "scheduled" | "preview" | "live";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

function fromLocalInput(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function buildForm(s: StreamSettings): SettingsForm {
  return {
    title: s.title,
    description: s.description,
    scheduledLocal: toLocalInput(s.scheduledStartAt),
    youtubeUrl: s.youtubeVideoId ?? "",
    goals: {
      subs: String(s.goals.subs),
      likes: String(s.goals.likes),
      viewers: String(s.goals.viewers),
    },
    scoringEnabled: s.scoringEnabled,
    banMode: s.banMode,
    highlightingEnabled: s.highlightingEnabled,
    autoDisplayFeatured: s.autoDisplayFeatured,
    waitingRoomChat: s.waitingRoomChat,
  };
}

function TranscriptPanel({
  streamId,
  live,
}: {
  streamId: string | null;
  live: boolean;
}) {
  const { data: segments = [] } = useTranscript(streamId, live);
  const { containerRef, onScroll } = useStickyScroll(segments.length);

  return (
    <div className="rounded-lg border">
      <div className="border-b px-3 py-2 text-sm font-semibold">
        Live transcription
      </div>
      <div
        ref={containerRef}
        onScroll={onScroll}
        className="h-48 space-y-1 overflow-y-auto p-3 text-sm"
      >
        {!live ? (
          <p className="text-xs text-muted-foreground">
            Transcription runs while you&apos;re live.
          </p>
        ) : segments.length === 0 ? (
          <p className="text-xs text-muted-foreground">Listening…</p>
        ) : (
          segments.map((s) => (
            <span key={s.id} className="text-muted-foreground">
              {s.text}{" "}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

function StatusToolbar({
  state,
  broadcast,
  form,
  dirty,
  onSaveClick,
  saving,
  demo,
}: {
  state: StreamState;
  broadcast: Stream | null;
  form: SettingsForm;
  dirty: boolean;
  onSaveClick: () => void;
  saving: boolean;
  demo: boolean;
}) {
  const goLive = useGoLive();
  const endStream = useEndStream();
  const discard = useDiscardBroadcast();

  const streamId = broadcast?.id ?? null;
  // Observe-only: the owner's control page must not count itself as audience or
  // take a viewer-cap slot.
  const count = useWaitingCount(
    state === "live" || state === "scheduled" ? streamId : null,
    { track: false }
  );

  const disconnected = broadcast ? isFeedDisconnected(broadcast) : false;
  const canGoLive = state === "preview";
  const canDiscard =
    state === "draft" || state === "scheduled" || state === "preview";

  const statusLabel: Record<StreamState, string> = {
    none: "No broadcast",
    draft: "Draft",
    scheduled: "Scheduled",
    preview: "Preview",
    live: disconnected ? "Live · disconnected" : "Live",
  };

  return (
    <div className="flex flex-wrap items-center gap-2 border-t bg-background px-4 py-2">
      {demo ? (
        <Badge variant="secondary">Demo mode</Badge>
      ) : (
        <>
          <Badge
            variant={
              state === "live"
                ? "default"
                : state === "preview"
                  ? "secondary"
                  : "outline"
            }
          >
            {statusLabel[state]}
          </Badge>
          {state === "live" && (
            <span className="text-xs text-muted-foreground">
              {count} watching
            </span>
          )}
          {state === "scheduled" && (
            <span className="text-xs text-muted-foreground">
              {count} waiting
            </span>
          )}
        </>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {!demo && canDiscard && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={discard.isPending}>
                Discard
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Discard this broadcast?</AlertDialogTitle>
                <AlertDialogDescription>
                  {state === "preview"
                    ? "Because your encoder is still connected, a blank private preview will remain. Stop the stream in OBS to fully clear it. No VOD is created."
                    : "This deletes the broadcast and its settings. No VOD is created."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => discard.mutate()}>
                  Discard
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}

        {!demo && (state === "live" ? (
          disconnected ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm" disabled={endStream.isPending}>
                  End stream
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>End the broadcast?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Viewers stop seeing the stream and the VOD is finalized from
                    the recorded footage since you went live.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => endStream.mutate()}>
                    End stream
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  End stream
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Encoder still connected</AlertDialogTitle>
                  <AlertDialogDescription>
                    Stop the stream in OBS first, then end it here. Ending while
                    connected would immediately start a new preview.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>OK</AlertDialogCancel>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="destructive"
                size="sm"
                disabled={!canGoLive || goLive.isPending}
              >
                Go live
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Go live now?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your broadcast becomes public on your channel and recording
                  starts from this moment.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() =>
                    goLive.mutate({
                      title: form.title,
                      description: form.description,
                    })
                  }
                >
                  Go live
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ))}

        <Button size="sm" disabled={!dirty || saving} onClick={onSaveClick}>
          Save changes
        </Button>
      </div>
    </div>
  );
}

export default function LivePage() {
  const { isPending: ownerPending, isOwner } = useRequireOwner();
  const { data: broadcast } = useCurrentBroadcast();
  const settingsQuery = useStreamSettings();
  const save = useSaveStreamSettings();

  const settings = settingsQuery.data;
  const streamId = settings?.streamId ?? null;
  const dbForm = useMemo(
    () => (settings ? buildForm(settings) : null),
    [settings]
  );

  const [form, setForm] = useState<SettingsForm | null>(dbForm);
  const [syncedId, setSyncedId] = useState<string | null | undefined>(undefined);
  const [confirm, setConfirm] = useState<ScheduleSaveCheck | null>(null);
  const [tab, setTab] = useState("settings");
  const [demo, setDemo] = useState(false);
  const panelOpen = useDemoLayoutStore((s) => s.panelOpen);
  const setPanelOpen = useDemoLayoutStore((s) => s.setPanelOpen);

  useDemoLayout(demo);
  useDemoController(demo);

  const demoGoals = settings?.goals ?? null;

  // Sync the form from the DB only when the active stream changes (not on every
  // background refetch), so in-progress edits are preserved.
  if (settings && syncedId !== streamId) {
    setSyncedId(streamId);
    setForm(dbForm);
  }

  const status = broadcast?.status ?? "none";
  const state: StreamState = (
    ["draft", "scheduled", "preview", "live"].includes(status) ? status : "none"
  ) as StreamState;
  const isPublic = state === "live";

  const dirty =
    !!form && !!dbForm && JSON.stringify(form) !== JSON.stringify(dbForm);

  const buildPayload = (f: SettingsForm) => ({
    title: f.title,
    description: f.description,
    scheduledStartAt: fromLocalInput(f.scheduledLocal),
    youtubeUrl: f.youtubeUrl,
    goals: {
      subs: Number(f.goals.subs) || 0,
      likes: Number(f.goals.likes) || 0,
      viewers: Number(f.goals.viewers) || 0,
    },
    scoringEnabled: f.scoringEnabled,
    banMode: f.banMode,
    highlightingEnabled: f.highlightingEnabled,
    autoDisplayFeatured: f.autoDisplayFeatured,
    waitingRoomChat: f.waitingRoomChat,
  });

  const doSave = async (f: SettingsForm) => {
    await save.mutateAsync(buildPayload(f));
    const fresh = await settingsQuery.refetch();
    if (fresh.data) {
      setSyncedId(fresh.data.streamId);
      setForm(buildForm(fresh.data));
    }
  };

  const onSaveClick = () => {
    if (!form || !settings) return;
    const check = evaluateScheduleSave({
      scheduledStartAt: fromLocalInput(form.scheduledLocal),
      previousScheduledStartAt: settings.scheduledStartAt,
      workerRunning: settings.workerRunning,
      hasYoutubeUrl: !!form.youtubeUrl.trim(),
      waitingRoomChat: form.waitingRoomChat,
    });
    if (check.requiresConfirmation) {
      setConfirm(check);
    } else {
      void doSave(form);
    }
  };

  if (ownerPending || !isOwner) {
    return (
      <div className="mx-auto w-full max-w-6xl p-4 md:p-6">
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const previewSrc = broadcast?.hls_path ?? null;
  const disconnected = broadcast ? isFeedDisconnected(broadcast) : false;

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-6xl flex-col">
      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="mx-4 mt-4 flex shrink-0 items-center justify-between gap-2">
          <TabsList>
            <TabsTrigger value="settings">Settings</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-3">
            {settings?.channelSlug &&
              !demo &&
              (tab === "preview" || tab === "activity") && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label={`Pop out the ${tab} panel`}
                  onClick={() =>
                    tab === "preview"
                      ? window.open(
                          `/popout/${settings.channelSlug}?panel=preview`,
                          "vt-popout-preview",
                          "width=820,height=520"
                        )
                      : window.open(
                          `/popout/${settings.channelSlug}?panel=all`,
                          "vt-popout-all",
                          "width=460,height=940"
                        )
                  }
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            <div className="flex items-center gap-1.5 text-xs font-medium">
              {demo && tab === "preview" && !panelOpen && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Show overlay controls"
                  onClick={() => setPanelOpen(true)}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                </Button>
              )}
              <span>Demo</span>
              <Switch
                checked={demo}
                onCheckedChange={(v) => {
                  setDemo(v);
                  if (v) setTab("preview");
                }}
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          <TabsContent
            value="settings"
            className="mt-0 h-full overflow-y-auto p-4 md:p-6"
          >
            {settingsQuery.isPending || !form || !settings ? (
              <Skeleton className="h-96 w-full" />
            ) : (
              <SettingsTab
                form={form}
                setForm={setForm}
                channelSlug={settings.channelSlug}
                thumbnailPath={broadcast?.thumbnail_path ?? null}
                isPublic={isPublic}
                workerRunning={settings.workerRunning}
              />
            )}
          </TabsContent>

          <TabsContent
            value="preview"
            className="mt-0 h-full space-y-3 overflow-y-auto p-4 md:p-6"
          >
            {demo ? (
              <DemoPreviewStage goals={demoGoals} />
            ) : previewSrc ? (
              <div className="relative">
                <LivePlayer src={previewSrc} />
                {disconnected && <DisconnectedOverlay />}
                {state === "preview" && (
                  <Badge variant="secondary" className="absolute left-2 top-2">
                    Preview — only you can see this
                  </Badge>
                )}
              </div>
            ) : (
              <div className="flex aspect-video w-full items-center justify-center rounded-lg border text-sm text-muted-foreground">
                Start your encoder to see the private preview here.
              </div>
            )}
            {!demo && (
              <TranscriptPanel streamId={streamId} live={state === "live"} />
            )}
          </TabsContent>

          <TabsContent
            value="activity"
            className="mt-0 flex h-full min-h-0 flex-col p-4 md:p-6"
          >
            {demo ? <DemoActivity goals={demoGoals} /> : <ActivityContent />}
          </TabsContent>
        </div>
      </Tabs>

      {form && (
        <StatusToolbar
          state={state}
          broadcast={broadcast ?? null}
          form={form}
          dirty={dirty}
          onSaveClick={onSaveClick}
          saving={save.isPending}
          demo={demo}
        />
      )}

      <AlertDialog
        open={!!confirm}
        onOpenChange={(open) => !open && setConfirm(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.firstTimePublic
                ? "Publish this scheduled broadcast?"
                : "Save with these warnings?"}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {confirm?.firstTimePublic && (
                  <p>
                    A public scheduled page will appear on your channel with a
                    countdown.
                    {confirm.publicChat
                      ? " Waiting-room chat is on, so that chat will be public too."
                      : ""}
                  </p>
                )}
                {confirm?.warnings.map((w, i) => (
                  <p key={i} className="text-amber-600 dark:text-amber-400">
                    {w}
                  </p>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Fix first</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (form) void doSave(form);
                setConfirm(null);
              }}
            >
              {confirm && confirm.warnings.length > 0
                ? "Schedule anyway"
                : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
