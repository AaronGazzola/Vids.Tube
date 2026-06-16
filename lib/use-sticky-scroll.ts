import { useCallback, useEffect, useRef, useState } from "react";

const BOTTOM_THRESHOLD = 48;

export function useStickyScroll(itemCount: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const stickyRef = useRef(true);
  const [showJump, setShowJump] = useState(false);

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    el.scrollTo({ top: el.scrollHeight, behavior });
    stickyRef.current = true;
    setShowJump(false);
  }, []);

  const onScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) {
      return;
    }
    const distanceFromBottom =
      el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom <= BOTTOM_THRESHOLD;
    stickyRef.current = atBottom;
    if (atBottom) {
      setShowJump(false);
    }
  }, []);

  useEffect(() => {
    if (stickyRef.current) {
      scrollToBottom("smooth");
    } else {
      setShowJump(true);
    }
  }, [itemCount, scrollToBottom]);

  return { containerRef, onScroll, showJump, scrollToBottom };
}
