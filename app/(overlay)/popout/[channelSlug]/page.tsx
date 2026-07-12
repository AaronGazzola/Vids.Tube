"use client";

import { ActivityContent } from "@/app/(app)/live/panels";

// The pop-out window renders the exact same Activity content as the /live tab.
export default function PopoutPage() {
  return (
    <div className="flex h-screen flex-col bg-background p-3 text-foreground">
      <ActivityContent />
    </div>
  );
}
