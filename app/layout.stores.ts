import { create } from "zustand";
import type { User } from "@supabase/supabase-js";

type AuthStore = {
  user: User | null;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  setUser: (user) => set({ user, isAuthenticated: !!user }),
}));

type VerifyBannerStore = {
  collapsedUserId: string | null;
  setCollapsed: (userId: string, collapsed: boolean) => void;
};

export const useVerifyBannerStore = create<VerifyBannerStore>((set) => ({
  collapsedUserId: null,
  setCollapsed: (userId, collapsed) =>
    set({ collapsedUserId: collapsed ? userId : null }),
}));
