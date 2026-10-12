import { type RefObject, useEffect, useState } from "react";

const OVERSCAN = 6;

export type VirtualRange = {
  start: number;
  end: number;
  offsetTop: number;
  offsetBottom: number;
};

/** Windowing for long fixed-height lists: only rows near the viewport are rendered. */
export function useVirtualList(scrollRef: RefObject<HTMLElement | null>, count: number, rowHeight: number): VirtualRange {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    const measure = () => setViewportHeight(element.clientHeight || 600);
    const onScroll = () => setScrollTop(element.scrollTop);
    measure();
    onScroll();
    element.addEventListener("scroll", onScroll, { passive: true });
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : null;
    observer?.observe(element);
    return () => {
      element.removeEventListener("scroll", onScroll);
      observer?.disconnect();
    };
  }, [scrollRef]);

  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN);
  const end = Math.min(count, Math.ceil((scrollTop + viewportHeight) / rowHeight) + OVERSCAN);
  return { start, end, offsetTop: start * rowHeight, offsetBottom: Math.max(0, (count - end) * rowHeight) };
}
