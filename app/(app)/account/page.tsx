"use client";

import { useMyChannel, useOwnerChannel, useRequireAuth } from "@/app/layout.hooks";
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
import { toast } from "sonner";

function stubToast(title: string) {
  toast.custom(() => (
    <CustomToast variant="notification" title={title} message="Coming soon" />
  ));
}

export default function AccountPage() {
  const { isPending, isAuthenticated } = useRequireAuth();
  const user = useAuthStore((state) => state.user);
  const { data: channel, isPending: channelPending } = useMyChannel();
  const { data: ownerChannel } = useOwnerChannel();

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
