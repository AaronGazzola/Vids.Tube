"use client";

import { useHandleAvailability, useUserAuth } from "@/app/layout.hooks";
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
import {
  HANDLE_REQUIREMENT,
  isValidHandle,
  normalizeHandle,
} from "@/lib/handle";
import { cn } from "@/lib/utils";
import { Check, Loader2, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SignupPage() {
  const { signUp } = useUserAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [debounced, setDebounced] = useState("");

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

  const checking =
    formatValid && (availability.isPending || debounced !== normalized);
  const available = formatValid && availability.data?.available === true;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!available) {
      return;
    }
    signUp.mutate({ email, password, handle: normalized });
  };

  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Sign up</CardTitle>
          <CardDescription>Create your vids.tube account</CardDescription>
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
                  required
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
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Password</Label>
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
            <Button type="submit" disabled={!available || signUp.isPending}>
              {signUp.isPending ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-muted-foreground">
            Have an account?{" "}
            <Link className="underline" href="/login">
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
