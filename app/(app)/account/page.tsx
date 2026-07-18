"use client";

import {
  useIsOwner,
  useMyChannel,
  useOwnerChannel,
  useRequireAuth,
} from "@/app/layout.hooks";
import { useAuthStore } from "@/app/layout.stores";
import { ChannelSettingsForm } from "@/components/channel-settings-form";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { channelAssetUrl } from "@/lib/storage";
import { Info } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { OriginBadge } from "@/components/origin-badge";
import {
  useBannedParticipants,
  useRegenerateYoutubeCode,
  useSaveYoutubeLink,
  useUnbanParticipant,
  useUnlinkYoutube,
  useYoutubeLink,
} from "./page.hooks";

function stubToast(title: string) {
  toast.custom(() => (
    <CustomToast variant="notification" title={title} message="Coming soon" />
  ));
}

function BannedUsersCard() {
  const { data: banned, isPending } = useBannedParticipants(true);
  const unban = useUnbanParticipant();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Banned users</CardTitle>
        <CardDescription>
          People blocked from chatting on your channel. Bans apply across all
          streams until you unban.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : !banned?.length ? (
          <p className="text-sm text-muted-foreground">No one is banned.</p>
        ) : (
          <ul className="divide-y">
            {banned.map((b) => {
              const label = b.handle
                ? `@${b.handle}`
                : b.authorName ?? "viewer";
              return (
                <li
                  key={b.participantKey}
                  className="flex items-center gap-2 py-2"
                >
                  <OriginBadge origin={b.origin} className="shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{label}</p>
                    {b.reason && (
                      <p className="truncate text-xs text-muted-foreground">
                        {b.reason}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={unban.isPending}
                    onClick={() => unban.mutate(b.participantKey)}
                  >
                    Unban
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function YoutubeLinkCard({ ownerHandle }: { ownerHandle: string | null }) {
  const { data: link, isPending } = useYoutubeLink();
  const save = useSaveYoutubeLink();
  const regenerate = useRegenerateYoutubeCode();
  const unlink = useUnlinkYoutube();
  const [handleInput, setHandleInput] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>YouTube account</CardTitle>
        <CardDescription>
          Link your YouTube handle so your chat activity on YouTube and
          Vids.Tube counts as one viewer history.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isPending ? (
          <Skeleton className="h-16 w-full" />
        ) : link ? (
          <div className="space-y-3">
            <p className="text-sm">
              Linked to <span className="font-medium">@{link.youtubeHandle}</span>{" "}
              {link.verifiedAt ? (
                <span className="ml-1 rounded bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-600">
                  Verified
                </span>
              ) : (
                <span className="ml-1 rounded bg-amber-500/15 px-1.5 py-0.5 text-xs font-medium text-amber-600">
                  Unverified
                </span>
              )}
            </p>
            {!link.verifiedAt && (
              <div className="space-y-2 rounded-md border p-3 text-sm">
                <p className="text-muted-foreground">
                  To verify it&apos;s yours, post this code in{" "}
                  {ownerHandle ? `@${ownerHandle}` : "the channel"}&apos;s
                  YouTube live chat from that account during a stream:
                </p>
                <code className="block w-fit rounded bg-muted px-3 py-1.5 font-mono text-base font-semibold tracking-widest">
                  {link.verifyCode}
                </code>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={regenerate.isPending}
                  onClick={() => regenerate.mutate()}
                >
                  New code
                </Button>
              </div>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              disabled={unlink.isPending}
              onClick={() => unlink.mutate()}
            >
              Unlink
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              placeholder="@yourhandle"
              value={handleInput}
              onChange={(e) => setHandleInput(e.target.value)}
            />
            <Button
              disabled={!handleInput.trim() || save.isPending}
              onClick={() => save.mutate(handleInput)}
            >
              Link
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AccountPage() {
  const { isPending, isAuthenticated } = useRequireAuth();
  const user = useAuthStore((state) => state.user);
  const { data: channel, isPending: channelPending } = useMyChannel();
  const { data: ownerChannel } = useOwnerChannel();
  const isOwner = useIsOwner();

  if (isPending || !isAuthenticated) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 p-4 md:p-6">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const email = user?.email ?? "";
  const initials = email ? email.slice(0, 2).toUpperCase() : "?";
  const avatarUrl = channelAssetUrl(channel?.avatar_path ?? null);
  const ownerHandle = ownerChannel?.handle;

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={channel?.name ?? ""} />}
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          {channelPending ? (
            <Skeleton className="h-7 w-40" />
          ) : (
            <h1 className="text-2xl font-bold">{channel?.name ?? email}</h1>
          )}
          {channelPending ? (
            <Skeleton className="mt-1 h-4 w-32" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {channel ? `@${channel.handle}` : email}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          For now you can watch {ownerHandle ? `@${ownerHandle}` : "the channel"}
          &apos;s VODs and live streams, and join in by commenting and chatting.
          Posting your own content isn&apos;t available yet — it&apos;s coming in
          a later version of the app.
        </p>
      </div>

      <ChannelSettingsForm />

      <YoutubeLinkCard ownerHandle={ownerHandle ?? null} />

      {isOwner && <BannedUsersCard />}

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
          <CardDescription>Email and password.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue={email} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <Input id="password" type="password" placeholder="••••••••" />
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button variant="outline" onClick={() => stubToast("Email update")}>
            Update email
          </Button>
          <Button variant="outline" onClick={() => stubToast("Password change")}>
            Change password
          </Button>
        </CardFooter>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Danger zone</CardTitle>
          <CardDescription>
            Permanently delete your account and data.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Delete account</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                <AlertDialogDescription>
                  This cannot be undone. Your account and all associated data
                  will be permanently removed.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => stubToast("Account deletion")}>
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardFooter>
      </Card>
    </main>
  );
}
