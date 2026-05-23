"use client";

import { useCreditsStore } from "@/app/layout.stores";
import { Badge } from "@/components/ui/badge";
import { Coins } from "lucide-react";
import Link from "next/link";

export function CreditsBadge() {
  const balance = useCreditsStore((state) => state.balance);

  return (
    <Link href="/credits" aria-label="Credits">
      <Badge variant="secondary" className="gap-1">
        <Coins className="h-3.5 w-3.5" />
        {balance}
      </Badge>
    </Link>
  );
}
