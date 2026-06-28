"use client";

import { cn } from "@/lib/utils";
import {
  CalendarClock,
  LayoutDashboard,
  MonitorPlay,
  Radio,
  Settings,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/studio", label: "Overview", icon: LayoutDashboard },
  { href: "/studio/live", label: "Go Live", icon: Radio },
  { href: "/studio/control", label: "Control room", icon: SlidersHorizontal },
  { href: "/studio/broadcasts", label: "Broadcasts", icon: CalendarClock },
  { href: "/studio/overlay", label: "Chat Overlay", icon: Sparkles },
  { href: "/studio/demo", label: "Overlay Demo", icon: MonitorPlay },
  { href: "/studio/settings", label: "Settings", icon: Settings },
];

export function StudioSidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto border-b p-2 md:w-56 md:flex-col md:border-b-0 md:border-r md:p-3">
      {items.map((item) => {
        const active = pathname === item.href;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
