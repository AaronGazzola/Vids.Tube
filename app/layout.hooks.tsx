"use client";

import { CustomToast } from "@/components/CustomToast";
import { supabase } from "@/supabase/browser-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "./layout.stores";
import type { AuthCredentials } from "./layout.types";

export function useUser() {
  const setUser = useAuthStore((state) => state.setUser);

  return useQuery({
    queryKey: ["user"],
    queryFn: async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setUser(user);
      return user;
    },
  });
}

export function useIsOwner() {
  return useAuthStore((state) => state.isAuthenticated);
}

export function useUserAuth() {
  const queryClient = useQueryClient();
  const router = useRouter();

  const signUp = useMutation({
    mutationFn: async ({ email, password }: AuthCredentials) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        console.error(error);
        if (
          error.status === 400 &&
          error.message.includes("already registered")
        ) {
          const { error: resendError } = await supabase.auth.resend({
            type: "signup",
            email,
          });

          if (resendError) {
            console.error(resendError);
            throw new Error(
              "User already exists. Failed to resend verification email"
            );
          }

          return { needsVerification: true };
        }
        throw error;
      }

      return data;
    },
    onSuccess: (data) => {
      if ("needsVerification" in data) {
        toast.custom(() => (
          <CustomToast
            variant="notification"
            title="Verification email resent"
            message="Please check your email to verify your account"
          />
        ));
      } else {
        toast.custom(() => (
          <CustomToast
            variant="success"
            title="Account created"
            message="Please check your email to verify your account"
          />
        ));
      }
      router.push("/verify");
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Sign up failed"
          message={error.message}
        />
      ));
    },
  });

  const signIn = useMutation({
    mutationFn: async ({ email, password }: AuthCredentials) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error(error);
        throw new Error("Failed to sign in");
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Signed in successfully"
          message="Welcome back!"
        />
      ));
      router.push("/");
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Sign in failed"
          message={error.message}
        />
      ));
    },
  });

  const signOut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.signOut();

      if (error) {
        console.error(error);
        throw new Error("Failed to sign out");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Signed out successfully"
          message="See you next time!"
        />
      ));
      router.push("/");
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Sign out failed"
          message={error.message}
        />
      ));
    },
  });

  return { signUp, signIn, signOut };
}
