"use client";

import { useRequireOwner } from "@/app/layout.hooks";
import { StudioSidebar } from "@/components/studio-sidebar";
import { Skeleton } from "@/components/ui/skeleton";

export default function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isPending, isOwner } = useRequireOwner();

  if (isPending || !isOwner) {
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 p-6">
        <Skeleton className="h-40 w-full" />
      </main>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col md:flex-row">
      <StudioSidebar />
      <div className="flex-1 p-4 md:p-6">{children}</div>
    </div>
  );
}
