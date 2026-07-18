"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
  getDemoFramesAction,
  getDemoLayoutAction,
  saveDemoLayoutAction,
} from "./demo.actions";
import { useDemoGeneratorStore, useDemoLayoutStore } from "./demo.stores";

// Hydrate the layout store from the DB when demo turns on, then debounce-persist
// any changes the owner makes (drag, toggle, background) back to the DB.
export function useDemoLayout(enabled: boolean) {
  const hydrate = useDemoLayoutStore((s) => s.hydrate);
  const config = useDemoLayoutStore((s) => s.config);
  const query = useQuery({
    queryKey: ["demo-layout"],
    queryFn: () => getDemoLayoutAction(),
    enabled,
  });
  const save = useMutation({
    mutationFn: async (c: typeof config) => {
      const res = await saveDemoLayoutAction(c);
      if ("error" in res) throw new Error(res.error);
      return res.data;
    },
  });

  const hydratedRef = useRef(false);
  const lastSavedRef = useRef<string>("");

  useEffect(() => {
    if (query.data && !hydratedRef.current) {
      hydratedRef.current = true;
      lastSavedRef.current = JSON.stringify(query.data);
      hydrate(query.data);
    }
  }, [query.data, hydrate]);

  const saveMutate = save.mutate;
  useEffect(() => {
    if (!hydratedRef.current) return;
    const serialized = JSON.stringify(config);
    if (serialized === lastSavedRef.current) return;
    const t = setTimeout(() => {
      lastSavedRef.current = serialized;
      saveMutate(config);
    }, 700);
    return () => clearTimeout(t);
  }, [config, saveMutate]);

  useEffect(() => {
    if (!enabled) hydratedRef.current = false;
  }, [enabled]);

  return { hydrated: query.isSuccess };
}

export function useDemoFrames(enabled: boolean) {
  return useQuery({
    queryKey: ["demo-frames"],
    queryFn: () => getDemoFramesAction(),
    enabled,
  });
}

// Seed the roster and run the generator while demo is on.
export function useDemoController(enabled: boolean) {
  const seed = useDemoGeneratorStore((s) => s.seed);
  const tick = useDemoGeneratorStore((s) => s.tick);
  useEffect(() => {
    if (!enabled) return;
    seed();
    for (let i = 0; i < 40; i++) tick();
    const id = setInterval(() => tick(), 1600);
    return () => clearInterval(id);
  }, [enabled, seed, tick]);
}
