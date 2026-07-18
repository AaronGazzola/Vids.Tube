"use client";

import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createCustomCommandAction,
  deleteCustomCommandAction,
  getChannelCommandsAdminAction,
  updateCustomCommandAction,
  type CustomCommandInput,
} from "./commands.actions";

const adminCommandsKey = ["channel-commands-admin"] as const;

function useInvalidateCommands() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: adminCommandsKey });
    queryClient.invalidateQueries({ queryKey: ["channel-commands"] });
  };
}

export function useChannelCommandsAdmin() {
  return useQuery({
    queryKey: adminCommandsKey,
    queryFn: () => getChannelCommandsAdminAction(),
  });
}

function commandErrorToast(title: string) {
  return (error: Error) => {
    toast.custom(() => (
      <CustomToast variant="error" title={title} message={error.message} />
    ));
  };
}

export function useCreateCustomCommand() {
  const invalidate = useInvalidateCommands();
  return useMutation({
    mutationFn: async (input: CustomCommandInput) => {
      const res = await createCustomCommandAction(input);
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: invalidate,
    onError: commandErrorToast("Couldn't add the command"),
  });
}

export function useUpdateCustomCommand() {
  const invalidate = useInvalidateCommands();
  return useMutation({
    mutationFn: async (vars: { id: string; input: CustomCommandInput }) => {
      const res = await updateCustomCommandAction(vars.id, vars.input);
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: invalidate,
    onError: commandErrorToast("Couldn't update the command"),
  });
}

export function useDeleteCustomCommand() {
  const invalidate = useInvalidateCommands();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteCustomCommandAction(id);
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: invalidate,
    onError: commandErrorToast("Couldn't delete the command"),
  });
}
