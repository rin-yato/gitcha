import {
  clampSidebarWidth,
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
} from "@/lib/config";

import type React from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export type ReviewLayoutState = {
  isSidebarOpen: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  shrinkSidebar: () => void;
  growSidebar: () => void;
};

export { MAX_SIDEBAR_WIDTH, MIN_SIDEBAR_WIDTH };

const ReviewLayoutContext = createContext<ReviewLayoutState | null>(null);

export function ReviewLayoutProvider({
  children,
  initialSidebarWidth = DEFAULT_SIDEBAR_WIDTH,
}: {
  children: React.ReactNode;
  initialSidebarWidth?: number;
}) {
  const resolvedInitialSidebarWidth = clampSidebarWidth(initialSidebarWidth);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(resolvedInitialSidebarWidth);
  const previousSidebarWidthRef = useRef(resolvedInitialSidebarWidth);

  const commitSidebarWidth = useCallback((nextWidth: number) => {
    const clampedWidth = clampSidebarWidth(nextWidth);
    previousSidebarWidthRef.current = clampedWidth;
    setSidebarWidth(clampedWidth);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((open) => {
      if (open) {
        previousSidebarWidthRef.current = sidebarWidth;
        setSidebarWidth(0);
      } else {
        const nextWidth = previousSidebarWidthRef.current;
        setSidebarWidth(nextWidth);
      }
      return !open;
    });
  }, [sidebarWidth]);

  const shrinkSidebar = useCallback(() => {
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
      commitSidebarWidth(previousSidebarWidthRef.current - 5);
      return;
    }
    commitSidebarWidth(sidebarWidth - 5);
  }, [commitSidebarWidth, isSidebarOpen]);

  const growSidebar = useCallback(() => {
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
      commitSidebarWidth(previousSidebarWidthRef.current + 5);
      return;
    }
    commitSidebarWidth(sidebarWidth + 5);
  }, [commitSidebarWidth, isSidebarOpen]);

  const value = useMemo<ReviewLayoutState>(
    () => ({
      isSidebarOpen,
      sidebarWidth,
      toggleSidebar,
      shrinkSidebar,
      growSidebar,
    }),
    [isSidebarOpen, sidebarWidth, toggleSidebar, shrinkSidebar, growSidebar],
  );

  return <ReviewLayoutContext.Provider value={value}>{children}</ReviewLayoutContext.Provider>;
}

export function useReviewLayout() {
  const ctx = useContext(ReviewLayoutContext);
  if (!ctx) throw new Error("useReviewLayout must be used within ReviewLayoutProvider");
  return ctx;
}
