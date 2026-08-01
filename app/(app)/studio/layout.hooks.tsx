"use client";

import { listOwnerStreamsAction } from "@/app/(app)/studio/layout.actions";
import type { OwnerStream } from "@/app/(app)/studio/layout.types";
import { useQuery } from "@tanstack/react-query";

export function useOwnerStreams() {
  return useQuery<OwnerStream[]>({
    queryKey: ["studio", "owner-streams"],
    queryFn: async () => {
      const res = await listOwnerStreamsAction();
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
  });
}
