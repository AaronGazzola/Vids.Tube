"use client";

import { useUser, useUserAuth } from "@/app/layout.hooks";
import { useAuthStore } from "@/app/layout.stores";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export function Nav() {
  const { isPending } = useUser();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { signOut } = useUserAuth();

  return (
    <nav className="flex items-center justify-between border-b px-4 py-3">
      <Link href="/" className="font-semibold">
        vids.tube
      </Link>
      <div className="flex items-center gap-3 text-sm">
        {isPending ? (
          <Skeleton className="h-8 w-24" />
        ) : isAuthenticated ? (
          <Button
            variant="ghost"
            onClick={() => signOut.mutate()}
            disabled={signOut.isPending}
          >
            Sign out
          </Button>
        ) : (
          <>
            <Button variant="ghost" asChild>
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild>
              <Link href="/signup">Sign up</Link>
            </Button>
          </>
        )}
      </div>
    </nav>
  );
}
