"use client";

import { useChannel } from "@/app/[channelSlug]/page.hooks";
import { useLiveStream } from "@/app/layout.hooks";
import { FeaturedAvatar } from "@/components/overlay/featured-avatar";
import { use, useState } from "react";
import { useFeaturedMessages } from "./page.hooks";

export default function OverlayPage({
  params,
}: {
  params: Promise<{ channelSlug: string }>;
}) {
  const { channelSlug } = use(params);
  const { data: channel } = useChannel(channelSlug);
  const { data: stream } = useLiveStream(channel?.id);

  const streamId = stream?.status === "live" ? stream.id : null;
  const { data: featured } = useFeaturedMessages(streamId);

  const [doneIds, setDoneIds] = useState<Set<string>>(new Set());

  const current = streamId
    ? featured?.find((m) => !doneIds.has(m.id)) ?? null
    : null;

  if (!current) return null;

  return (
    <FeaturedAvatar
      key={current.id}
      featured={current}
      onDone={() =>
        setDoneIds((prev) => {
          const next = new Set(prev);
          next.add(current.id);
          return next;
        })
      }
    />
  );
}
