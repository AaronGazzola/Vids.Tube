"use client";

import { LiveStreamView } from "@/components/live-stream-view";
import { useParams } from "next/navigation";

export default function LiveStreamPage() {
  const params = useParams<{ channelSlug: string }>();
  return <LiveStreamView slug={params.channelSlug} />;
}
