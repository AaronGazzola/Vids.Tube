"use client";

import { useIsOwner, useUser } from "@/app/layout.hooks";
import { useAuthStore } from "@/app/layout.stores";
import { AccountMenu } from "@/components/account-menu";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  LogIn,
  Menu,
  Radio,
  User,
  UserPlus,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/account", label: "Account", icon: User },
  { href: "/live", label: "Go Live", icon: Radio, ownerOnly: true },
];

function useVisibleNavItems() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isOwner = useIsOwner();

  if (!isAuthenticated) {
    return [];
  }
  return NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner);
}

function ToggleButton() {
  const { toggleSidebar } = useSidebar();
  return (
    <button
      type="button"
      onClick={toggleSidebar}
      aria-label="Toggle sidebar"
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Menu className="h-5 w-5" />
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

function SidebarAuthLinks({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild aria-label="Log in">
              <Link href="/login">
                <LogIn className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Log in</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" asChild aria-label="Sign up">
              <Link href="/signup">
                <UserPlus className="h-4 w-4" />
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">Sign up</TooltipContent>
        </Tooltip>
      </>
    );
  }

  return (
    <>
      <Button variant="ghost" className="w-full justify-start" asChild>
        <Link href="/login">Log in</Link>
      </Button>
      <Button className="w-full" asChild>
        <Link href="/signup">Sign up</Link>
      </Button>
    </>
  );
}

function AppSidebarBody({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const { isPending } = useUser();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const items = useVisibleNavItems();

  return (
    <div className="flex h-full flex-col bg-background">
      {collapsed ? (
        <div className="flex flex-col items-center gap-3 px-2 pb-2 pt-3">
          <Link href="/" aria-label="Vids.Tube home">
            <Logo className="h-auto w-9" />
          </Link>
          {isAuthenticated && <ToggleButton />}
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
          {isAuthenticated && <ToggleButton />}
        </div>
      )}

      {items.length > 0 && (
        <SidebarContent className={cn("gap-1 p-2", collapsed && "items-center")}>
          {items.map((item) => (
            <NavRow
              key={item.href}
              item={item}
              active={pathname === item.href}
              collapsed={collapsed}
            />
          ))}
        </SidebarContent>
      )}

      <div
        className={cn(
          "mt-auto flex flex-col gap-1 p-2",
          collapsed && "items-center"
        )}
      >
        <ThemeToggle collapsed={collapsed} />
        {isPending ? (
          <Skeleton
            className={collapsed ? "h-8 w-8 rounded-full" : "h-11 w-full"}
          />
        ) : isAuthenticated ? (
          <AccountMenu collapsed={collapsed} />
        ) : (
          <SidebarAuthLinks collapsed={collapsed} />
        )}
      </div>
    </div>
  );
}

export function AppSidebar() {
  const measureRef = useRef<HTMLDivElement>(null);
  const { setOpen } = useSidebar();
  const { isPending } = useUser();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      setOpen(false);
    }
  }, [isPending, isAuthenticated, setOpen]);

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
