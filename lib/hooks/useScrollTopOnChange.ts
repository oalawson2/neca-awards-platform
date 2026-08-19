"use client";

import { useEffect } from "react";

/**
 * Scrolls the window to the top whenever `dep` changes. For multi-step
 * flows that swap content via local component state (a pillar/section
 * index) rather than an actual route change, Next.js's own scroll-to-top
 * on navigation never fires — there's no navigation event to hook into —
 * so the page silently keeps whatever scroll position the previous step
 * left it at.
 */
export function useScrollTopOnChange(dep: unknown): void {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [dep]);
}
