"use client";

import { useQuery } from "@tanstack/react-query";
import { getChannelBySlugAction } from "./page.actions";

export function useChannel(slug: string) {
  return useQuery({
    queryKey: ["channel", slug],
    queryFn: () => getChannelBySlugAction(slug),
  });
}
