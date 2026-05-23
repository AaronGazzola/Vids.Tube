"use client";

import { useIsOwner, useUserAuth } from "@/app/layout.hooks";
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
import { LayoutDashboard, LogOut, User as UserIcon } from "lucide-react";
import Link from "next/link";

function initials(email: string | undefined) {
  if (!email) {
    return "?";
  }
  return email.slice(0, 2).toUpperCase();
}

export function AccountMenu() {
  const user = useAuthStore((state) => state.user);
  const isOwner = useIsOwner();
  const { signOut } = useUserAuth();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarFallback>{initials(user?.email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
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
        {isOwner && (
          <DropdownMenuItem asChild>
            <Link href="/studio">
              <LayoutDashboard className="mr-2 h-4 w-4" />
              Studio
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => signOut.mutate()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
