"use client";

import { useYoutubeLink } from "@/app/(app)/account/page.hooks";
import { useAuthStore } from "@/app/layout.stores";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// Anyone can open a chatter's page from a link in chat, so the wording asks
// rather than tells: the reader is usually not the person the page belongs to.
//
// Rendered only on an unclaimed channel, and only for someone who could still
// claim an identity — a visitor whose own YouTube account is already verified
// has nothing to claim here, whoever's page they are looking at.
export function ClaimChannelStrip() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const { data: link, isPending } = useYoutubeLink();

  if (isAuthenticated && (isPending || link?.verifiedAt)) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-l-4 border-l-muted-foreground/40 bg-muted/30 px-4 py-2.5">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Is this you?</span> Claim
        this profile to merge your YouTube history into a Vids.Tube account.
      </p>
      <Button asChild size="sm" variant="outline">
        <Link href={isAuthenticated ? "/account" : "/login"}>Claim</Link>
      </Button>
    </div>
  );
}
