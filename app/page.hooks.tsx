"use client";

import { useQuery } from "@tanstack/react-query";
import { getOwnerChannelAction } from "./page.actions";

export function useOwnerChannel() {
  return useQuery({
    queryKey: ["owner-channel"],
    queryFn: () => getOwnerChannelAction(),
  });
}
