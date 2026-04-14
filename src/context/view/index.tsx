import type React from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

import type { CompareTarget } from "@/lib/git";

import { useReviewSession } from "../session/session";

export type ViewMode = "staging" | "compare";

export type ReviewViewState = {
  viewMode: ViewMode;
  enterCompareMode: (target: CompareTarget) => Promise<void>;
  exitCompareMode: () => void;
  selectCompareBranch: (target: CompareTarget) => Promise<void>;
};

const ReviewViewContext = createContext<ReviewViewState | null>(null);

export function ReviewViewProvider({ children }: { children: React.ReactNode }) {
  const git = useReviewSession();
  const [viewMode, setViewMode] = useState<ReviewViewState["viewMode"]>("staging");

  const enterCompareMode = useCallback(
    async (target: Parameters<ReviewViewState["enterCompareMode"]>[0]) => {
      const nextState = await git.startCompare(target);
      if (nextState) setViewMode("compare");
    },
    [git],
  );

  const exitCompareMode = useCallback(() => {
    git.stopCompare();
    setViewMode("staging");
  }, [git]);

  const selectCompareBranch = useCallback(
    async (target: Parameters<ReviewViewState["selectCompareBranch"]>[0]) => {
      await git.startCompare(target);
      setViewMode("compare");
    },
    [git],
  );

  const value = useMemo<ReviewViewState>(
    () => ({
      viewMode,
      enterCompareMode,
      exitCompareMode,
      selectCompareBranch,
    }),
    [viewMode, enterCompareMode, exitCompareMode, selectCompareBranch],
  );

  return <ReviewViewContext.Provider value={value}>{children}</ReviewViewContext.Provider>;
}

export function useReviewView() {
  const ctx = useContext(ReviewViewContext);
  if (!ctx) throw new Error("useReviewView must be used within ReviewViewProvider");
  return ctx;
}
