"use client";

import { Logo } from "@/components/logo";
import {
  Sidebar,
  SidebarContent,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  PanelRightClose,
  PanelRightOpen,
  Radio,
  SlidersHorizontal,
  User,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/account", label: "Account", icon: User },
  { href: "/go-live", label: "Go Live", icon: Radio },
  { href: "/control", label: "Control room", icon: SlidersHorizontal },
];

function ToggleButton({ collapsed }: { collapsed: boolean }) {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label="Toggle sidebar"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {collapsed ? (
        <PanelRightClose className="h-5 w-5" />
      ) : (
        <PanelRightOpen className="h-5 w-5" />
      )}
    </button>
  );
}

function NavRow({
  item,
  active,
  collapsed,
}: {
  item: NavItem;
  active: boolean;
  collapsed: boolean;
}) {
  const Icon = item.icon;

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Link
            href={item.href}
            aria-label={item.label}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-md transition-colors",
              active
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
          </Link>
        </TooltipTrigger>
        <TooltipContent side="right">{item.label}</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <Link
      href={item.href}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

function AppSidebarBody({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full flex-col bg-background">
      {collapsed ? (
        <div className="flex flex-col items-center gap-3 px-2 pb-2 pt-3">
          <Link href="/" aria-label="Vids.Tube home">
            <Logo className="h-auto w-9" />
          </Link>
          <ToggleButton collapsed />
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 p-2">
          <Link
            href="/"
            className="flex items-center gap-2 font-(family-name:--font-logo) text-lg font-bold tracking-tight whitespace-nowrap"
          >
            <Logo className="h-auto w-9" />
            Vids.Tube
          </Link>
          <ToggleButton collapsed={false} />
        </div>
      )}

      <SidebarContent className={cn("gap-1 p-2", collapsed && "items-center")}>
        {NAV_ITEMS.map((item) => (
          <NavRow
            key={item.href}
            item={item}
            active={pathname === item.href}
            collapsed={collapsed}
          />
        ))}
      </SidebarContent>
    </div>
  );
}

export function AppSidebar() {
  const measureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = measureRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    const apply = () => {
      const width = Math.ceil(el.getBoundingClientRect().width);
      if (width > 0) {
        document.documentElement.style.setProperty(
          "--sidebar-width",
          `${width + 16}px`
        );
      }
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <>
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none invisible fixed left-0 top-0 -z-50 h-0 w-max overflow-hidden"
      >
        <AppSidebarBody collapsed={false} />
      </div>
      <Sidebar
        collapsible="icon"
        className="border-r"
        expandedContent={<AppSidebarBody collapsed={false} />}
        collapsedContent={<AppSidebarBody collapsed={true} />}
      />
    </>
  );
}
