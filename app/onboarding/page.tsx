"use client";

import {
  useCreateChannel,
  useHandleAvailability,
  useMyChannel,
  useRequireAuth,
} from "@/app/layout.hooks";
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
import {
  HANDLE_REQUIREMENT,
  isValidHandle,
  normalizeHandle,
} from "@/lib/handle";
import { cn } from "@/lib/utils";
import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function OnboardingPage() {
  const router = useRouter();
  const { isPending: authPending, isAuthenticated } = useRequireAuth();
  const myChannel = useMyChannel();
  const createChannel = useCreateChannel();

  const [handle, setHandle] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    if (myChannel.data) {
      router.replace("/");
    }
  }, [myChannel.data, router]);

  const normalized = normalizeHandle(handle);
  const formatValid = isValidHandle(normalized);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(normalized), 350);
    return () => clearTimeout(timer);
  }, [normalized]);

  const availability = useHandleAvailability(
    debounced,
    formatValid && debounced === normalized
  );

  if (authPending || !isAuthenticated || myChannel.isPending || myChannel.data) {
    return (
      <main className="mx-auto w-full max-w-md flex-1 p-4 md:p-6">
        <Skeleton className="h-64 w-full" />
      </main>
    );
  }

  const checking =
    formatValid && (availability.isPending || debounced !== normalized);
  const available = formatValid && availability.data?.available === true;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!available) {
      return;
    }
    createChannel.mutate(
      { handle: normalized },
      { onSuccess: () => router.push("/") }
    );
  };

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center p-4 md:p-6">
      <Card className="w-full">
        <CardHeader>
          <CardTitle>Choose your handle</CardTitle>
          <CardDescription>
            Your <span className="font-medium">@handle</span> is your identity
            across vids.tube. You can change it later.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="handle">Handle</Label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  @
                </span>
                <Input
                  id="handle"
                  name="handle"
                  autoFocus
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="yourname"
                  className="pl-7"
                  value={handle}
                  onChange={(event) => setHandle(event.target.value)}
                />
              </div>
              {handle.length > 0 && !formatValid && (
                <p className="text-sm text-destructive">{HANDLE_REQUIREMENT}</p>
              )}
              {checking && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Checking availability…
                </p>
              )}
              {!checking && formatValid && availability.data && (
                <p
                  className={cn(
                    "flex items-center gap-1.5 text-sm",
                    available ? "text-emerald-600" : "text-destructive"
                  )}
                >
                  {available ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <X className="h-3.5 w-3.5" />
                  )}
                  {available
                    ? `@${normalized} is available`
                    : `@${normalized} is taken`}
                </p>
              )}
            </div>
            <Button
              type="submit"
              disabled={!available || createChannel.isPending}
            >
              {createChannel.isPending ? "Creating…" : "Create channel"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
