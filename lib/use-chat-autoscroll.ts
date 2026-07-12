import { useCallback, useEffect, useRef } from "react";

// Re-arm auto-scroll once the user is within this many px of the bottom. It must
// exceed the list's bottom padding so reaching the visual bottom re-arms.
const REARM_THRESHOLD = 80;

// Conditional auto-scroll for a message list, refs-only so scroll handling never
// triggers a re-render:
//   - starts pinned to the bottom,
//   - follows new messages while the view is at/near the bottom,
//   - stops following once the user scrolls up,
//   - re-arms when the user scrolls back to the bottom.
// Disarming is direction-based (user scrolled up); re-arming is position-based
// (within REARM_THRESHOLD of the bottom) — mixing the two avoids momentum-scroll
// flicker near the bottom.
export function useChatAutoScroll<
  S extends HTMLElement = HTMLDivElement,
  C extends HTMLElement = HTMLDivElement,
>(itemCount: number) {
  const scrollRef = useRef<S>(null);
  const contentRef = useRef<C>(null);
  const autoScrollRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const lastScrollHeightRef = useRef(0);

  const scrollToBottom = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !autoScrollRef.current) {
      return;
    }
    el.scrollTop = el.scrollHeight;
    lastScrollTopRef.current = el.scrollTop;
    lastScrollHeightRef.current = el.scrollHeight;
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) {
      return;
    }
    const { scrollTop, scrollHeight, clientHeight } = el;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    // When content shrinks, the browser clamps scrollTop down — that is not the
    // user scrolling up, so don't disarm on it.
    const shrank = scrollHeight < lastScrollHeightRef.current;
    const scrolledUp = !shrank && scrollTop < lastScrollTopRef.current - 2;

    lastScrollTopRef.current = scrollTop;
    lastScrollHeightRef.current = scrollHeight;

    if (scrolledUp) {
      autoScrollRef.current = false;
    } else if (distanceFromBottom <= REARM_THRESHOLD) {
      autoScrollRef.current = true;
    }
  }, []);

  // Any height change of the content wrapper (new messages, images loading) pins
  // to the bottom while armed.
  useEffect(() => {
    const content = contentRef.current;
    if (!content) {
      return;
    }
    const observer = new ResizeObserver(() => scrollToBottom());
    observer.observe(content);
    return () => observer.disconnect();
  }, [scrollToBottom]);

  // Initial mount + message-count changes start pinned to the bottom.
  useEffect(() => {
    scrollToBottom();
  }, [itemCount, scrollToBottom]);

  return { scrollRef, contentRef, onScroll };
}
