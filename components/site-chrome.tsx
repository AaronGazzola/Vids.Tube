"use client";

import { Toaster } from "@/components/ui/sonner";
import { usePathname } from "next/navigation";

function useIsOverlay() {
  const pathname = usePathname();
  return pathname?.startsWith("/overlay") ?? false;
}

export function SiteToaster() {
  return useIsOverlay() ? null : <Toaster />;
}
