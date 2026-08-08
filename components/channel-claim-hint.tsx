"use client";

import {
  useEnsureVerifyCode,
  useRegenerateYoutubeCode,
} from "@/app/(app)/account/page.hooks";
import { useOwnerChannel } from "@/app/layout.hooks";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function ChannelClaimHint({
  channel,
}: {
  channel: { youtube_channel_id: string | null };
}) {
  const { data } = useEnsureVerifyCode(true, false);
  const { data: ownerChannel } = useOwnerChannel();
  const regenerate = useRegenerateYoutubeCode();
  const [copied, setCopied] = useState(false);

  // A channel already carrying a YouTube identity has nothing left to claim.
  // The verify-code row can lag behind that — an identity can reach a channel by
  // a repair or a merge without the code ever being posted — so the channel is
  // the truth here, not the code.
  if (channel.youtube_channel_id) {
    return null;
  }

  if (!data || data.verifiedAt) {
    return null;
  }

  const ownerHandle = ownerChannel?.handle;

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(data.verifyCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  // A quiet strip rather than a panel: this sits on the owner's own channel
  // page, above their memberships and videos, and should not outweigh them.
  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-l-4 border-l-muted-foreground/40 bg-muted/30 px-4 py-2.5">
      <p className="text-sm text-muted-foreground">
        <span className="font-medium text-foreground">
          Claim your YouTube profile
        </span>{" "}
        — post this code in {ownerHandle ? `@${ownerHandle}` : "the stream"}
        &apos;s YouTube live chat from your YouTube account.
      </p>
      <div className="ml-auto flex items-center gap-1.5">
        <code className="rounded bg-muted px-2.5 py-1 font-mono text-sm font-semibold tracking-widest">
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
