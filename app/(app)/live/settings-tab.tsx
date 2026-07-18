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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { vodAssetUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { Copy, Eye, EyeOff, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import {
  useRegenerateStreamKey,
  useStreamKey,
  useUploadBroadcastThumbnail,
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

const STREAM_HOST = process.env.NEXT_PUBLIC_STREAM_HOST ?? "";

export type SettingsForm = {
  title: string;
  description: string;
  scheduledLocal: string;
  youtubeUrl: string;
  goals: { subs: string; likes: string; viewers: string };
  scoringEnabled: boolean;
  banMode: "suggest" | "auto";
  ttsMode: "suggest" | "auto";
  askMode: "suggest" | "auto";
  highlightingEnabled: boolean;
  usefulInfoEnabled: boolean;
  competitionStatusEnabled: boolean;
  progressUpdateEnabled: boolean;
  wrapupMvpEnabled: boolean;
  wrapupSummaryEnabled: boolean;
  wrapupThanksEnabled: boolean;
  autoDisplayFeatured: boolean;
  waitingRoomChat: boolean;
  disabledCommands: string[];
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

export function SettingsTab({
  form,
  setForm,
  channelSlug,
  thumbnailPath,
  isPublic,
  workerRunning,
}: {
  form: SettingsForm;
  setForm: (f: SettingsForm) => void;
  channelSlug: string;
  thumbnailPath: string | null;
  isPublic: boolean;
  workerRunning: boolean;
}) {
  const uploadThumbnail = useUploadBroadcastThumbnail();
  const [opacityPct, setOpacityPct] = useState(90);
  const thumbnailUrl = vodAssetUrl(thumbnailPath);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const base = `${origin}/overlay/${channelSlug}`;

  const set = (patch: Partial<SettingsForm>) => setForm({ ...form, ...patch });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
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
            accept="image/jpeg,image/png,image/webp"
            disabled={uploadThumbnail.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadThumbnail.mutate(file);
            }}
          />
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
      </Section>

      <Section title="OBS overlays">
        <CopyRow label="Highlights" url={base} dimensions="460 × 400" />
        <CopyRow label="Goal · Subs" url={`${base}/goals/subs`} dimensions="600 × 160" />
        <CopyRow label="Goal · Likes" url={`${base}/goals/likes`} dimensions="200 × 820" />
        <CopyRow label="Goal · Viewers" url={`${base}/goals/viewers`} dimensions="160 × 160" />
        <CopyRow
          label="Competition"
          url={`${base}/competition?opacity=${(opacityPct / 100).toFixed(2)}`}
          dimensions="120 × 300"
        />
        <div className="space-y-1 pt-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Competition opacity</span>
            <span className="text-xs tabular-nums text-muted-foreground">{opacityPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={opacityPct}
            onChange={(e) => setOpacityPct(Number(e.target.value))}
            aria-label="Competition overlay opacity"
            className="w-full accent-primary"
          />
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
        <SwitchRow
          label="Auto-answer !ask (vs suggest)"
          description="On: grounded answers post without a click. Off: you approve each Q&A."
          checked={form.askMode === "auto"}
          onCheckedChange={(v) => set({ askMode: v ? "auto" : "suggest" })}
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
        <p className="text-xs text-muted-foreground">
          Transcription, chat scoring, moderation, and YouTube chat need the local
          worker. Start it with:
        </p>
        <code className="block rounded bg-muted px-2 py-1 font-mono text-xs">npm run worker</code>
      </Section>
    </div>
  );
}
