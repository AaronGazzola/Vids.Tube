"use client";

import { cn } from "@/lib/utils";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";

export type WatchLayoutMode = "default" | "fullscreen";

export type WatchLayoutValue = {
  mode: WatchLayoutMode;
  setMode: (mode: WatchLayoutMode) => void;
  stageRef: RefObject<HTMLDivElement | null>;
  toggleFullscreen: () => void;
  chatAvailable: boolean;
  chatOverlayVisible: boolean;
  toggleChatOverlay: () => void;
};

const WatchLayoutContext = createContext<WatchLayoutValue | null>(null);

const useIsomorphicLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

// The player is also used outside a watch surface (the Studio timeline, the
// pop-out preview), so the absence of a provider is a normal case, not a bug.
export function useWatchLayout(): WatchLayoutValue | null {
  return useContext(WatchLayoutContext);
}

export function WatchLayoutProvider({
  chatAvailable = false,
  chatOverlayDefault = false,
  children,
}: {
  chatAvailable?: boolean;
  chatOverlayDefault?: boolean;
  children: ReactNode;
}) {
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [mode, setMode] = useState<WatchLayoutMode>("default");
  const [chatOverlayVisible, setChatOverlayVisible] =
    useState(chatOverlayDefault);

  // Escape and the browser's own fullscreen exit never route through our
  // button, so the mode follows the document rather than the click.
  useEffect(() => {
    const sync = () => {
      setMode(
        document.fullscreenElement === stageRef.current
          ? "fullscreen"
          : "default"
      );
    };
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  const toggleChatOverlay = useCallback(() => {
    setChatOverlayVisible((visible) => !visible);
  }, []);

  // The stage, not the player's own box, is what goes fullscreen, so the chat
  // can sit over the video rather than outside it.
  const toggleFullscreen = useCallback(() => {
    const target = stageRef.current;
    if (!target) {
      return;
    }
    if (document.fullscreenElement === target) {
      void document.exitFullscreen().catch((error) => {
        console.error(error);
      });
    } else {
      void target.requestFullscreen().catch((error) => {
        console.error(error);
      });
    }
  }, []);

  const value = useMemo<WatchLayoutValue>(
    () => ({
      mode,
      setMode,
      stageRef,
      toggleFullscreen,
      chatAvailable,
      chatOverlayVisible,
      toggleChatOverlay,
    }),
    [mode, toggleFullscreen, chatAvailable, chatOverlayVisible, toggleChatOverlay]
  );

  return (
    <WatchLayoutContext.Provider value={value}>
      {children}
    </WatchLayoutContext.Provider>
  );
}

// `chatBounded` is false when the chat slot holds something that should size to
// its own content — a collapsed replay is a single button, not a panel that
// should claim a viewport row.
export function WatchStage({
  player,
  chat,
  chatBounded = true,
  className,
}: {
  player: ReactNode;
  chat?: ReactNode;
  chatBounded?: boolean;
  className?: string;
}) {
  const layout = useWatchLayout();
  const localRef = useRef<HTMLDivElement | null>(null);
  const stageRef = layout?.stageRef ?? localRef;
  const fullscreen = layout?.mode === "fullscreen";
  const overlayVisible = layout?.chatOverlayVisible ?? false;
  const stageTop = useStageTop(stageRef, !!chat && chatBounded && !fullscreen);

  if (!chat) {
    return (
      <div ref={stageRef} className={cn("w-full", className)}>
        {player}
      </div>
    );
  }

  return (
    <div
      ref={stageRef}
      style={{ "--stage-top": `${stageTop}px` } as CSSProperties}
      className={cn(
        fullscreen
          ? "relative flex h-full w-full items-center justify-center bg-black"
          : chatBounded
            ? "grid h-stage grid-rows-[auto_minmax(0,1fr)] gap-3 lg:h-auto lg:grid-cols-[1fr_340px] lg:grid-rows-[auto] lg:gap-4"
            : "flex flex-col gap-3 lg:gap-4",
        className
      )}
    >
      <div
        className={cn(
          fullscreen
            ? "flex h-full w-full items-center justify-center"
            : "min-w-0"
        )}
      >
        {player}
      </div>
      {/* At lg the chat is taken out of flow so the row is sized by the player
          alone; otherwise a long chat would stretch the row and the two columns
          would no longer end level. */}
      <div
        className={cn(
          fullscreen
            ? "absolute inset-y-0 right-0 z-20 flex w-full max-w-sm flex-col p-2 transition-opacity duration-200"
            : chatBounded
              ? "flex min-h-0 flex-col lg:relative lg:block"
              : "flex flex-col",
          fullscreen && !overlayVisible && "pointer-events-none opacity-0"
        )}
      >
        <div
          className={cn(
            "flex min-h-0 flex-col",
            fullscreen || !chatBounded
              ? "h-full"
              : "h-full lg:absolute lg:inset-0"
          )}
        >
          {chat}
        </div>
      </div>
    </div>
  );
}

// The stage claims the viewport from wherever it starts down to the bottom
// edge, so the composer under a long chat stays on screen.
function useStageTop(
  stageRef: RefObject<HTMLDivElement | null>,
  enabled: boolean
): number {
  const [top, setTop] = useState(0);

  useIsomorphicLayoutEffect(() => {
    if (!enabled) {
      setTop(0);
      return;
    }
    const measure = () => {
      const element = stageRef.current;
      if (!element) {
        return;
      }
      const offset = element.getBoundingClientRect().top + window.scrollY;
      setTop(Math.max(0, Math.round(offset)));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [stageRef, enabled]);

  return top;
}
