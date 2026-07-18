"use client";

import { useQuery } from "@tanstack/react-query";
import { getChannelCommandsAction } from "./page.actions";

export function useChannelCommands(slug: string | undefined) {
  return useQuery({
    queryKey: ["channel-commands", slug],
    queryFn: () => getChannelCommandsAction(slug!),
    enabled: !!slug,
  });
}
