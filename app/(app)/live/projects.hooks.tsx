"use client";

import { CustomToast } from "@/components/CustomToast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  createProjectAction,
  deleteProjectAction,
  getChannelProjectsAction,
  updateProjectAction,
  type ProjectInput,
} from "./projects.actions";

const projectsKey = ["channel-projects"] as const;

function projectErrorToast(title: string) {
  return (error: Error) => {
    toast.custom(() => (
      <CustomToast variant="error" title={title} message={error.message} />
    ));
  };
}

export function useChannelProjects() {
  return useQuery({
    queryKey: projectsKey,
    queryFn: () => getChannelProjectsAction(),
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProjectInput) => {
      const res = await createProjectAction(input);
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
    onError: projectErrorToast("Couldn't add the project"),
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (vars: { id: string; input: ProjectInput }) => {
      const res = await updateProjectAction(vars.id, vars.input);
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
    onError: projectErrorToast("Couldn't update the project"),
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteProjectAction(id);
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectsKey }),
    onError: projectErrorToast("Couldn't delete the project"),
  });
}
