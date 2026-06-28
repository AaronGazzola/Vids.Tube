"use client";

import { CustomToast } from "@/components/CustomToast";
import { supabase } from "@/supabase/browser-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  checkHandleAvailabilityAction,
  createChannelAction,
  getAuthorIdentityAction,
  getChatMessagesAction,
  getLiveStreamAction,
  getMyChannelAction,
  getOwnerChannelAction,
  postChatMessageAction,
  signUpAction,
  updateChannelAction,
} from "./layout.actions";
import { useAuthStore } from "./layout.stores";
import type {
  AuthCredentials,
  ChatMessage,
  ChatMessageRow,
  CreateChannelInput,
  SignUpInput,
  UpdateChannelInput,
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
  const user = useAuthStore((state) => state.user);
  const { data: ownerChannel } = useOwnerChannel();
  if (!user || !ownerChannel) {
    return false;
  }
  return ownerChannel.owner_user_id === user.id;
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
  const { isPending: userPending } = useUser();
  const { isPending: channelPending } = useOwnerChannel();
  const isOwner = useIsOwner();
  const router = useRouter();
  const isPending = userPending || channelPending;

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
    mutationFn: async ({ email, password, handle }: SignUpInput) => {
      const res = await signUpAction({ email, password, handle });
      if ("error" in res) throw new Error(res.error);

      const decision = res.data;
      const emailRedirectTo = `${window.location.origin}/auth/callback`;

      if (decision.action === "signin") {
        const { error } = await supabase.auth.signInWithOtp({
          email: decision.email,
          options: { shouldCreateUser: false, emailRedirectTo },
        });
        if (error) {
          console.error(error);
          throw new Error("Failed to send sign-in link");
        }
        return { success: true } as const;
      }

      if (decision.action === "resend") {
        const { error } = await supabase.auth.resend({
          type: "signup",
          email: decision.email,
          options: { emailRedirectTo },
        });
        if (error) {
          console.error(error);
          throw new Error("Failed to resend verification email");
        }
        return { success: true } as const;
      }

      const { error } = await supabase.auth.signUp({
        email: decision.email,
        password,
        options: {
          emailRedirectTo,
          data: { pending_handle: decision.handle },
        },
      });
      if (error) {
        console.error(error);
        if (error.message.includes("Database error saving new user")) {
          throw new Error(
            "Couldn't reserve that handle — it may have just been taken. Please choose another."
          );
        }
        throw new Error("Failed to create account");
      }
      return { success: true } as const;
    },
    onSuccess: () => {
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Check your email"
          message="Check your email inbox to continue."
        />
      ));
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

  const resetPassword = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });

      if (error) {
        console.error(error);
        throw new Error("Failed to send the reset email");
      }
    },
    onSuccess: () => {
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Check your email"
          message="We sent you a link to reset your password"
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't send reset email"
          message={error.message}
        />
      ));
    },
  });

  const updatePassword = useMutation({
    mutationFn: async ({ password }: { password: string }) => {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        console.error(error);
        throw new Error(error.message || "Failed to update your password");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user"] });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Password updated"
          message="You're all set — welcome back."
        />
      ));
      router.push("/");
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't update password"
          message={error.message}
        />
      ));
    },
  });

  return { signUp, signIn, signOut, resetPassword, updatePassword };
}

export function useOwnerChannel() {
  return useQuery({
    queryKey: ["owner-channel"],
    queryFn: () => getOwnerChannelAction(),
  });
}

export function useMyChannel() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  return useQuery({
    queryKey: ["my-channel"],
    queryFn: () => getMyChannelAction(),
    enabled: isAuthenticated,
  });
}

export function useHandleAvailability(handle: string, enabled: boolean) {
  return useQuery({
    queryKey: ["handle-availability", handle],
    queryFn: async () => {
      const res = await checkHandleAvailabilityAction(handle);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    enabled,
    retry: false,
  });
}

export function useCreateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateChannelInput) => {
      const res = await createChannelAction(input);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-channel"] });
      queryClient.invalidateQueries({ queryKey: ["owner-channel"] });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Channel created"
          message="Your handle is yours — welcome aboard."
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't create channel"
          message={error.message}
        />
      ));
    },
  });
}

export function useUpdateChannel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateChannelInput) => {
      const res = await updateChannelAction(input);
      if ("error" in res) {
        throw new Error(res.error);
      }
      return res.data;
    },
    onSuccess: (channel) => {
      queryClient.invalidateQueries({ queryKey: ["my-channel"] });
      queryClient.invalidateQueries({ queryKey: ["owner-channel"] });
      queryClient.invalidateQueries({ queryKey: ["channel", channel.slug] });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Channel updated"
          message="Your changes have been saved."
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Couldn't save changes"
          message={error.message}
        />
      ));
    },
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
          const row = payload.new as ChatMessageRow;
          const known = queryClient
            .getQueryData<ChatMessage[]>(["chat", streamId])
            ?.find((m) => m.user_id === row.user_id && m.author)?.author;
          const message: ChatMessage = { ...row, author: known ?? null };

          queryClient.setQueryData<ChatMessage[]>(
            ["chat", streamId],
            (old = []) =>
              old.some((m) => m.id === message.id) ? old : [...old, message]
          );

          if (!message.author) {
            getAuthorIdentityAction(row.user_id).then((author) => {
              if (!author) {
                return;
              }
              queryClient.setQueryData<ChatMessage[]>(
                ["chat", streamId],
                (old = []) =>
                  old.map((m) =>
                    m.user_id === row.user_id && !m.author
                      ? { ...m, author }
                      : m
                  )
              );
            });
          }
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
