import type { User } from "@supabase/supabase-js";

export type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
};

export type AuthCredentials = {
  email: string;
  password: string;
};
