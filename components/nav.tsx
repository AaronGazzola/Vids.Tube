"use client";

import { useUser } from "@/app/layout.hooks";
import { useAuthStore } from "@/app/layout.stores";
import { AccountMenu } from "@/components/account-menu";
import { CreditsBadge } from "@/components/credits-badge";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";

export function Nav() {
  const { isPending } = useUser();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-semibold tracking-tight"
        >
          <Logo className="h-6 w-6" />
          vids.tube
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          {isPending ? (
            <Skeleton className="h-8 w-20" />
          ) : isAuthenticated ? (
            <>
              <CreditsBadge />
              <AccountMenu />
            </>
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
    </header>
  );
}
