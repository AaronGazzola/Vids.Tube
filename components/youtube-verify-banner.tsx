"use client";

import {
  useEnsureVerifyCode,
  useRegenerateYoutubeCode,
} from "@/app/(app)/account/page.hooks";
import { useOwnerChannel } from "@/app/layout.hooks";
import { useAuthStore, useVerifyBannerStore } from "@/app/layout.stores";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown, Copy, Minus } from "lucide-react";
import { useState } from "react";

export function YoutubeVerifyBanner({ live }: { live: boolean }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const collapsedUserId = useVerifyBannerStore(
    (state) => state.collapsedUserId
  );
  const setCollapsed = useVerifyBannerStore((state) => state.setCollapsed);
  const { data } = useEnsureVerifyCode(isAuthenticated && !!user, live);
  const { data: ownerChannel } = useOwnerChannel();
  const regenerate = useRegenerateYoutubeCode();
  const [copied, setCopied] = useState(false);

  if (!isAuthenticated || !user || !data) {
    return null;
  }
  if (data.verifiedAt) {
    return null;
  }

  const collapsed = collapsedUserId === user.id;
  const ownerHandle = ownerChannel?.handle;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(user.id, false)}
        className="flex w-full items-center justify-between border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted/60"
      >
        <span className="font-medium">Link your YouTube history</span>
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
    );
  }

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(data.verifyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-2 border-b bg-muted/40 p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">Link your YouTube history</p>
        <button
          type="button"
          aria-label="Collapse"
          onClick={() => setCollapsed(user.id, true)}
          className="text-muted-foreground hover:text-foreground"
        >
          <Minus className="h-4 w-4" />
        </button>
      </div>
      <p className="text-muted-foreground">
        Post this code in {ownerHandle ? `@${ownerHandle}` : "the"}&apos;s
        YouTube live chat from your YouTube account. We&apos;ll link that channel
        to your Vids.Tube account automatically.
      </p>
      <div className="flex items-center gap-2">
        <code className="rounded bg-muted px-3 py-1.5 font-mono text-base font-semibold tracking-widest">
          {data.verifyCode}
        </code>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={copyCode}
          className="gap-1"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={regenerate.isPending}
          onClick={() => regenerate.mutate()}
        >
          New code
        </Button>
      </div>
    </div>
  );
}
