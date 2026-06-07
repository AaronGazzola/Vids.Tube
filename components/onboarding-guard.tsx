"use client";

import { useMyChannel, useUser } from "@/app/layout.hooks";
import { useAuthStore } from "@/app/layout.stores";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const EXEMPT_PREFIXES = [
  "/onboarding",
  "/login",
  "/signup",
  "/verify",
  "/auth",
];

export function OnboardingGuard() {
  const { isPending: userPending } = useUser();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const myChannel = useMyChannel();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (userPending || !isAuthenticated || myChannel.isPending) {
      return;
    }
    if (myChannel.data) {
      return;
    }
    if (EXEMPT_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      return;
    }
    router.replace("/onboarding");
  }, [
    userPending,
    isAuthenticated,
    myChannel.isPending,
    myChannel.data,
    pathname,
    router,
  ]);

  return null;
}
