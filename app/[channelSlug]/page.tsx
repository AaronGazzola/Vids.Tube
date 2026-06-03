"use client";

import { ChannelView } from "@/components/channel-view";
import { useParams } from "next/navigation";

export default function ChannelPage() {
  const params = useParams<{ channelSlug: string }>();
  return <ChannelView slug={params.channelSlug} />;
}
