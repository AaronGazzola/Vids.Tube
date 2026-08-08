"use client";

import { useChannelMemberships } from "@/app/[channelSlug]/page.hooks";
import { MembershipCard } from "@/components/membership-card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

function MembershipsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-40 w-full rounded-xl" />
    </div>
  );
}

export function MembershipsSection({ channelId }: { channelId: string }) {
  const { data: memberships, isPending } = useChannelMemberships(channelId);
  const sp = useSearchParams();
  const focusSlug = sp.get("c");
  const scrolledFor = useRef<string | null>(null);

  const hasFocus = !!memberships?.some((m) => m.communitySlug === focusSlug);

  useEffect(() => {
    // The browser's own anchor jump fires before this list exists, so the scroll
    // has to wait for the data. Guarded per slug so a refetch does not yank the
    // page back while someone is reading further down.
    if (!focusSlug || !hasFocus || scrolledFor.current === focusSlug) return;
    const el = document.getElementById(`community-${focusSlug}`);
    if (!el) return;
    scrolledFor.current = focusSlug;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusSlug, hasFocus]);

  if (isPending) {
    return (
      <section>
        <h2 className="mb-4 text-lg font-semibold tracking-tight">
          Memberships
        </h2>
        <MembershipsSkeleton />
      </section>
    );
  }

  // A channel that belongs to no community renders nothing at all: an empty
  // container reads as something broken rather than something absent.
  if (!memberships?.length) {
    return null;
  }

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold tracking-tight">Memberships</h2>
      <div className="flex flex-col gap-3">
        {memberships.map((membership) => (
          <MembershipCard
            key={membership.id}
            membership={membership}
            highlighted={membership.communitySlug === focusSlug}
          />
        ))}
      </div>
    </section>
  );
}
