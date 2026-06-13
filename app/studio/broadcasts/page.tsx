"use client";

import type { Stream } from "@/app/layout.types";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { vodAssetUrl } from "@/lib/storage";
import { CalendarClock, Plus } from "lucide-react";
import { useState } from "react";
import {
  useBroadcasts,
  useCancelScheduledBroadcast,
  useCreateScheduledBroadcast,
  useUpdateScheduledBroadcast,
  useUploadScheduledThumbnail,
} from "./page.hooks";

function toLocalInput(iso: string | null): string {
  if (!iso) {
    return "";
  }
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
    d.getDate()
  )}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatStart(iso: string | null): string {
  if (!iso) {
    return "No start time";
  }
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function BroadcastDialog({
  open,
  onOpenChange,
  broadcast,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  broadcast: Stream | null;
}) {
  const create = useCreateScheduledBroadcast();
  const update = useUpdateScheduledBroadcast();
  const uploadThumbnail = useUploadScheduledThumbnail();

  const [title, setTitle] = useState(broadcast?.title ?? "");
  const [description, setDescription] = useState(broadcast?.description ?? "");
  const [startAt, setStartAt] = useState(
    toLocalInput(broadcast?.scheduled_start_at ?? null)
  );
  const [file, setFile] = useState<File | null>(null);

  const isEdit = !!broadcast;
  const thumbnailUrl = vodAssetUrl(broadcast?.thumbnail_path ?? null);
  const pending = create.isPending || update.isPending || uploadThumbnail.isPending;

  const submit = async () => {
    try {
      if (isEdit) {
        await update.mutateAsync({
          id: broadcast.id,
          title,
          description,
          scheduledStartAt: startAt,
        });
        if (file) {
          await uploadThumbnail.mutateAsync({ id: broadcast.id, file });
        }
      } else {
        const created = await create.mutateAsync({
          title,
          description,
          scheduledStartAt: startAt,
        });
        if (file) {
          await uploadThumbnail.mutateAsync({ id: created.id, file });
        }
      }
      onOpenChange(false);
    } catch {
      return;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit scheduled broadcast" : "Schedule a broadcast"}
          </DialogTitle>
          <DialogDescription>
            Set it up ahead of time. Viewers see a countdown until you go live.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="What's this stream about?"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Optional"
              rows={3}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="start">Start time</Label>
            <Input
              id="start"
              type="datetime-local"
              value={startAt}
              onChange={(event) => setStartAt(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="thumbnail">Thumbnail</Label>
            {thumbnailUrl && !file && (
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
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            disabled={!title.trim() || !startAt || pending}
            onClick={submit}
          >
            {isEdit ? "Save changes" : "Schedule broadcast"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BroadcastRow({
  broadcast,
  variant,
  onEdit,
}: {
  broadcast: Stream;
  variant: "upcoming" | "missed" | "past";
  onEdit?: (broadcast: Stream) => void;
}) {
  const cancel = useCancelScheduledBroadcast();
  const thumbnailUrl = vodAssetUrl(broadcast.thumbnail_path);

  return (
    <div className="flex items-center gap-4 rounded-lg border p-3">
      <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-md bg-muted">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <CalendarClock className="h-5 w-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">
          {broadcast.title || "Untitled broadcast"}
        </p>
        <p className="text-sm text-muted-foreground">
          {variant === "past"
            ? "Ended"
            : formatStart(broadcast.scheduled_start_at)}
        </p>
      </div>
      {variant === "missed" && <Badge variant="outline">Missed</Badge>}
      {variant !== "past" && (
        <div className="flex shrink-0 gap-2">
          {variant === "upcoming" && onEdit && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEdit(broadcast)}
            >
              Edit
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={cancel.isPending}
              >
                {variant === "missed" ? "Delete" : "Cancel"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {variant === "missed"
                    ? "Delete this broadcast?"
                    : "Cancel this broadcast?"}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  It will be removed from your upcoming broadcasts and the
                  channel page.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep</AlertDialogCancel>
                <AlertDialogAction onClick={() => cancel.mutate(broadcast.id)}>
                  {variant === "missed" ? "Delete" : "Cancel broadcast"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  rows,
  variant,
  onEdit,
  empty,
}: {
  title: string;
  rows: Stream[];
  variant: "upcoming" | "missed" | "past";
  onEdit?: (broadcast: Stream) => void;
  empty?: string;
}) {
  if (rows.length === 0 && !empty) {
    return null;
  }
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <BroadcastRow
              key={row.id}
              broadcast={row}
              variant={variant}
              onEdit={onEdit}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default function StudioBroadcastsPage() {
  const { data, isPending } = useBroadcasts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Stream | null>(null);

  const openCreate = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (broadcast: Stream) => {
    setEditing(broadcast);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Broadcasts</h1>
        <Button type="button" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Schedule broadcast
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-2">
          <Skeleton className="h-20 w-full rounded-lg" />
          <Skeleton className="h-20 w-full rounded-lg" />
        </div>
      ) : (
        <>
          <Section
            title="Upcoming"
            rows={data?.upcoming ?? []}
            variant="upcoming"
            onEdit={openEdit}
            empty="No upcoming broadcasts. Schedule one to show a countdown on your channel."
          />
          <Section
            title="Missed"
            rows={data?.missed ?? []}
            variant="missed"
          />
          <Section title="Past" rows={data?.past ?? []} variant="past" />
        </>
      )}

      {dialogOpen && (
        <BroadcastDialog
          key={editing?.id ?? "new"}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          broadcast={editing}
        />
      )}
    </div>
  );
}
