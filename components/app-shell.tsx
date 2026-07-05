"use client";

import { AppSidebar } from "@/components/app-sidebar";
import { Nav } from "@/components/nav";
import { SidebarProvider } from "@/components/ui/sidebar";
import { usePathname } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare =
    (pathname?.startsWith("/overlay") ?? false) ||
    (pathname?.startsWith("/popout") ?? false);

  if (bare) {
    return <>{children}</>;
  }

  return (
    <SidebarProvider defaultOpen className="h-svh">
      <div className="relative flex h-full w-full overflow-hidden">
        <AppSidebar />
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <Nav />
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
