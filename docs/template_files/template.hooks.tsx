import { createClient } from "@/supabase/browser-client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createPostAction,
  deletePostAction,
  getPostsAction,
  getUserProfileAction,
  updatePostAction,
} from "./template.actions";
import { usePostsStore } from "./template.stores";
import type { PostInsert, PostUpdate } from "./template.types";
import { CustomToast } from "@/components/CustomToast";

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ["userProfile", userId],
    queryFn: () => getUserProfileAction(userId),
  });
}

export function useUserAuth() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  const signUp = useMutation({
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/welcome`,
        },
      });

      if (error) {
        console.error(error);
        if (error.status === 400 && error.message.includes("already registered")) {
          const { error: resendError } = await supabase.auth.resend({
            type: "signup",
            email,
          });

          if (resendError) {
            console.error(resendError);
            throw new Error("User already exists. Failed to resend verification email");
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
      window.location.href = "/verify";
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
    mutationFn: async ({
      email,
      password,
    }: {
      email: string;
      password: string;
    }) => {
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

export function usePosts(userId?: string) {
  const setPosts = usePostsStore((state) => state.setPosts);

  return useQuery({
    queryKey: ["posts", userId],
    queryFn: async () => {
      const posts = await getPostsAction(userId);
      setPosts(posts);
      return posts;
    },
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  const addPost = usePostsStore((state) => state.addPost);

  return useMutation({
    mutationFn: (post: PostInsert) => createPostAction(post),
    onSuccess: (newPost) => {
      addPost(newPost);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Post created"
          message="Your post has been created successfully"
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Failed to create post"
          message={error.message}
        />
      ));
    },
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();
  const updatePost = usePostsStore((state) => state.updatePost);

  return useMutation({
    mutationFn: ({
      postId,
      updates,
    }: {
      postId: string;
      updates: PostUpdate;
    }) => updatePostAction(postId, updates),
    onSuccess: (updatedPost) => {
      updatePost(updatedPost.id, updatedPost);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Post updated"
          message="Your post has been updated successfully"
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Failed to update post"
          message={error.message}
        />
      ));
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  const removePost = usePostsStore((state) => state.removePost);

  return useMutation({
    mutationFn: (postId: string) => deletePostAction(postId),
    onSuccess: (_, postId) => {
      removePost(postId);
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.custom(() => (
        <CustomToast
          variant="success"
          title="Post deleted"
          message="Your post has been deleted successfully"
        />
      ));
    },
    onError: (error) => {
      toast.custom(() => (
        <CustomToast
          variant="error"
          title="Failed to delete post"
          message={error.message}
        />
      ));
    },
  });
}

export function useRealtimePosts() {
  const supabase = createClient();
  const queryClient = useQueryClient();
  const { addPost, updatePost, removePost } = usePostsStore();

  return useQuery({
    queryKey: ["realtimePosts"],
    queryFn: () => {
      const channel = supabase
        .channel("posts-changes")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "posts",
          },
          (payload) => {
            addPost(payload.new as any);
            queryClient.invalidateQueries({ queryKey: ["posts"] });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "posts",
          },
          (payload) => {
            updatePost(payload.new.id as string, payload.new as any);
            queryClient.invalidateQueries({ queryKey: ["posts"] });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "DELETE",
            schema: "public",
            table: "posts",
          },
          (payload) => {
            removePost(payload.old.id as string);
            queryClient.invalidateQueries({ queryKey: ["posts"] });
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    },
    refetchInterval: false,
    refetchOnWindowFocus: false,
  });
}
