"use client";

import { CustomToast } from "@/components/CustomToast";
import { supabase } from "@/supabase/browser-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  getChatMessagesAction,
  getLiveStreamAction,
  getOwnerChannelAction,
  postChatMessageAction,
} from "./layout.actions";
import { useAuthStore } from "./layout.stores";
import type {
  AuthCredentials,
  ChatMessage,
  ViewerCapState,
} from "./layout.types";

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

export function useIsChannelOwner(
  channel: { owner_user_id: string } | null | undefined
) {
  const user = useAuthStore((state) => state.user);
  if (!channel || !user) {
    return false;
  }
  return channel.owner_user_id === user.id;
}

export function useRequireAuth() {
  const { isPending } = useUser();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isPending, isAuthenticated, router]);

  return { isPending, isAuthenticated };
}

export function useRequireOwner() {
  const { isPending } = useUser();
  const isOwner = useIsOwner();
  const router = useRouter();

  useEffect(() => {
    if (!isPending && !isOwner) {
      router.replace("/");
    }
  }, [isPending, isOwner, router]);

  return { isPending, isOwner };
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

export function useOwnerChannel() {
  return useQuery({
    queryKey: ["owner-channel"],
    queryFn: () => getOwnerChannelAction(),
  });
}

export function useLiveStream(channelId: string | undefined) {
  return useQuery({
    queryKey: ["live-stream", channelId],
    queryFn: () => getLiveStreamAction(channelId!),
    enabled: !!channelId,
    refetchInterval: 15000,
  });
}

export function useViewerCap(
  streamId: string | null,
  maxViewers: number
): ViewerCapState {
  const [state, setState] = useState<ViewerCapState>("connecting");

  useEffect(() => {
    if (!streamId) {
      return;
    }

    const presenceKey = crypto.randomUUID();
    const channel = supabase.channel(`presence:stream:${streamId}`, {
      config: { presence: { key: presenceKey } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const presence = channel.presenceState<{ online_at: string }>();
        const members = Object.entries(presence).map(([key, metas]) => ({
          key,
          at: metas[0]?.online_at ?? "",
        }));
        members.sort((a, b) =>
          a.at === b.at ? a.key.localeCompare(b.key) : a.at.localeCompare(b.at)
        );
        const rank = members.findIndex((m) => m.key === presenceKey);
        if (rank === -1) {
          setState("connecting");
        } else if (rank < maxViewers) {
          setState("admitted");
        } else {
          setState("full");
        }
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, maxViewers]);

  return state;
}

export function useLiveChat(streamId: string | null) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["chat", streamId],
    queryFn: () => getChatMessagesAction(streamId!),
    enabled: !!streamId,
  });

  useEffect(() => {
    if (!streamId) {
      return;
    }

    const channel = supabase
      .channel(`chat:${streamId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `stream_id=eq.${streamId}`,
        },
        (payload) => {
          const message = payload.new as ChatMessage;
          queryClient.setQueryData<ChatMessage[]>(
            ["chat", streamId],
            (old = []) =>
              old.some((m) => m.id === message.id) ? old : [...old, message]
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [streamId, queryClient]);

  return query;
}

export function usePostChatMessage(streamId: string | null) {
  return useMutation({
    mutationFn: async (body: string) => {
      const res = await postChatMessageAction(streamId!, body);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Message not sent"
          message={error.message}
        />
      ));
    },
  });
}
