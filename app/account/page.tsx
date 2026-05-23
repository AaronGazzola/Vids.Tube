"use client";

import { useRequireAuth } from "@/app/layout.hooks";
import { useAuthStore, useCreditsStore } from "@/app/layout.stores";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Coins } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

function stubToast(title: string) {
  toast.custom(() => (
    <CustomToast variant="notification" title={title} message="Coming soon" />
  ));
}

export default function AccountPage() {
  const { isPending, isAuthenticated } = useRequireAuth();
  const user = useAuthStore((state) => state.user);
  const balance = useCreditsStore((state) => state.balance);

  if (isPending || !isAuthenticated) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 p-4 md:p-6">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  const email = user?.email ?? "";
  const initials = email ? email.slice(0, 2).toUpperCase() : "?";
  const displayName = email ? email.split("@")[0] : "";

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4 md:p-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <h1 className="text-2xl font-bold">{displayName}</h1>
          <p className="text-sm text-muted-foreground">{email}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Your public display details.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <Input id="displayName" defaultValue={displayName} />
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => stubToast("Profile save")}>Save</Button>
        </CardFooter>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle>Credits</CardTitle>
          <CardDescription>Your viewing credit balance.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="flex items-center gap-1 text-lg font-semibold">
            <Coins className="h-5 w-5" />
            {balance}
          </span>
          <Button variant="secondary" asChild>
            <Link href="/credits">Manage credits</Link>
          </Button>
        </CardContent>
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
