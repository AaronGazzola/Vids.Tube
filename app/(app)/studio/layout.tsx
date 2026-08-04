"use client";

import type { StudioTool } from "@/app/(app)/studio/layout.types";
import { useRequireOwner } from "@/app/layout.hooks";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const STUDIO_TOOLS: StudioTool[] = [{ href: "/studio", label: "Streams" }];

function isToolActive(pathname: string, href: string): boolean {
  if (href === "/studio") {
    return pathname === "/studio" || pathname.startsWith("/studio/timeline");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isPending, isOwner } = useRequireOwner();
  const pathname = usePathname();

  if (isPending) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isOwner) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 sm:p-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold tracking-tight">Studio</h1>
        {STUDIO_TOOLS.length > 1 && (
          <nav className="flex gap-1 border-b">
            {STUDIO_TOOLS.map((tool) => (
              <Link
                key={tool.href}
                href={tool.href}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                  isToolActive(pathname, tool.href)
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {tool.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
      {children}
    </div>
  );
}
