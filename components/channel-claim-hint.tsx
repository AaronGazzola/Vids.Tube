"use client";

import {
  useEnsureVerifyCode,
  useRegenerateYoutubeCode,
} from "@/app/(app)/account/page.hooks";
import { useOwnerChannel } from "@/app/layout.hooks";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export function ChannelClaimHint() {
  const { data } = useEnsureVerifyCode(true, false);
  const { data: ownerChannel } = useOwnerChannel();
  const regenerate = useRegenerateYoutubeCode();
  const [copied, setCopied] = useState(false);

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

  return (
    <div className="mt-6 space-y-2 rounded-xl border bg-muted/40 p-4">
      <p className="font-medium">Claim your YouTube profile</p>
      <p className="text-sm text-muted-foreground">
        Post this code in {ownerHandle ? `@${ownerHandle}` : "the stream"}&apos;s
        YouTube live chat from your YouTube account. We&apos;ll merge your
        YouTube history into this channel automatically.
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
