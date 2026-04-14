import type React from "react";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

export type ReviewLayoutState = {
  isSidebarOpen: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  shrinkSidebar: () => void;
  growSidebar: () => void;
};

export const MIN_SIDEBAR_WIDTH = 20;
export const MAX_SIDEBAR_WIDTH = 80;

const ReviewLayoutContext = createContext<ReviewLayoutState | null>(null);

export function ReviewLayoutProvider({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(40);
  const previousSidebarWidthRef = useRef(40);

  const toggleSidebar = useCallback(() => {
    setIsSidebarOpen((open) => {
      if (open) {
        previousSidebarWidthRef.current = sidebarWidth;
        setSidebarWidth(0);
      } else {
        setSidebarWidth(previousSidebarWidthRef.current);
      }
      return !open;
    });
  }, [sidebarWidth]);

  const shrinkSidebar = useCallback(() => {
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
      setSidebarWidth(Math.max(MIN_SIDEBAR_WIDTH, previousSidebarWidthRef.current - 5));
      return;
    }
    setSidebarWidth((w) => Math.max(MIN_SIDEBAR_WIDTH, w - 5));
  }, [isSidebarOpen]);

  const growSidebar = useCallback(() => {
    if (!isSidebarOpen) {
      setIsSidebarOpen(true);
      setSidebarWidth(Math.min(MAX_SIDEBAR_WIDTH, previousSidebarWidthRef.current + 5));
      return;
    }
    setSidebarWidth((w) => Math.min(MAX_SIDEBAR_WIDTH, w + 5));
  }, [isSidebarOpen]);

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
