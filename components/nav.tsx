"use client";

import { useUser } from "@/app/layout.hooks";
import { useAuthStore } from "@/app/layout.stores";
import { AccountMenu } from "@/components/account-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSidebar } from "@/components/ui/sidebar";
import { Tv } from "lucide-react";
import Link from "next/link";

export function Nav() {
  const { isPending } = useUser();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { state } = useSidebar();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-2">
          {state !== "expanded" && (
            <Link
              href="/"
              className="font-(family-name:--font-logo) text-xl font-bold tracking-tight"
            >
              Vids.Tube
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" asChild>
            <Link href="/azanything" aria-label="View channel">
              <Tv className="h-5 w-5" />
              <span className="hidden sm:inline">View channel</span>
            </Link>
          </Button>
          <ThemeToggle />
          {isPending ? (
            <Skeleton className="h-8 w-20" />
          ) : isAuthenticated ? (
            <AccountMenu />
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
