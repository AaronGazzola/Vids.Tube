"use client";

import { useUser, useUserAuth } from "@/app/layout.hooks";
import { useAuthStore } from "@/app/layout.stores";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useState } from "react";

export default function ResetPasswordPage() {
  const { isPending } = useUser();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { updatePassword } = useUserAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const mismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (mismatch || password.length < 6) {
      return;
    }
    updatePassword.mutate({ password });
  };

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Choose a new password</CardTitle>
          <CardDescription>
            Enter a new password for your vids.tube account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <Skeleton className="h-32 w-full" />
          ) : !isAuthenticated ? (
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or has expired.{" "}
              <Link className="underline" href="/forgot-password">
                Request a new one
              </Link>
              .
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="password">New password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  name="confirm"
                  type="password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                />
                {mismatch && (
                  <p className="text-sm text-destructive">
                    Passwords don&apos;t match.
                  </p>
                )}
              </div>
              <Button
                type="submit"
                disabled={
                  updatePassword.isPending ||
                  mismatch ||
                  password.length < 6 ||
                  confirm.length === 0
                }
              >
                {updatePassword.isPending ? "Updating..." : "Update password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
