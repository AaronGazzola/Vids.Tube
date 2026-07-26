"use client";

import { useUserAuth } from "@/app/layout.hooks";
import { useAuthStore } from "@/app/layout.stores";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";

function initials(email: string | undefined) {
  if (!email) {
    return "?";
  }
  return email.slice(0, 2).toUpperCase();
}

export function AccountMenu({ collapsed = false }: { collapsed?: boolean }) {
  const user = useAuthStore((state) => state.user);
  const { signOut } = useUserAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {collapsed ? (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Account menu"
          >
            <Avatar className="h-8 w-8">
              <AvatarFallback>{initials(user?.email)}</AvatarFallback>
            </Avatar>
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="h-auto w-full justify-start gap-2 px-2 py-1.5"
            aria-label="Account menu"
          >
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback>{initials(user?.email)}</AvatarFallback>
            </Avatar>
            <span className="max-w-40 min-w-0 flex-1 truncate text-left text-sm font-medium">
              {user?.email ?? "Account"}
            </span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={collapsed ? "right" : "top"}
        align="start"
        className="w-52"
      >
        <DropdownMenuLabel className="truncate">
          {user?.email ?? "Account"}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserIcon className="mr-2 h-4 w-4" />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut.mutate()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
