"use client";

import { Nav } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";
import { usePathname } from "next/navigation";

function useIsOverlay() {
  const pathname = usePathname();
  return pathname?.startsWith("/overlay") ?? false;
}

export function SiteNav() {
  return useIsOverlay() ? null : <Nav />;
}

export function SiteToaster() {
  return useIsOverlay() ? null : <Toaster />;
}
