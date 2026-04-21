import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { useReviewSelection } from "../selection";
import { useReviewSession } from "../session/session";

export type DiffViewMode = "unified" | "split";

export type ReviewDiffState = {
  diffContent: string | null;
  unsupportedReason: string | null;
  isLoading: boolean;
  diffViewMode: DiffViewMode;
  toggleDiffViewMode: () => void;
};

const ReviewDiffContext = createContext<ReviewDiffState | null>(null);

export function ReviewDiffProvider({ children }: { children: React.ReactNode }) {
  const git = useReviewSession();
  const selection = useReviewSelection();
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [unsupportedReason, setUnsupportedReason] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [diffViewMode, setDiffViewMode] = useState<ReviewDiffState["diffViewMode"]>("unified");
  const diffLoadRequestRef = useRef(0);

  const loadDiff = useCallback(() => {
    const requestId = ++diffLoadRequestRef.current;

    if (!selection.selectedFile || !selection.selectedFileSection) {
      setDiffContent(null);
      setUnsupportedReason(null);
      setIsLoading(false);
      return;
    }

    const file = selection.focusedFile;
    if (!file) {
      setDiffContent(null);
      setUnsupportedReason(null);
      setIsLoading(false);
      return;
    }

    const section = selection.selectedFileSection;
    if (!section) {
      setDiffContent(null);
      setUnsupportedReason(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setUnsupportedReason(null);

    void (async () => {
      const reason = await git.client.getDiffUnsupportedReason(
        file,
        section,
        git.compareState?.baseRef,
        git.compareState?.targetRef,
        git.compareState?.mode,
      );

      if (requestId !== diffLoadRequestRef.current) return;

      if (reason) {
        setDiffContent(null);
        setUnsupportedReason(reason);
        setIsLoading(false);
        return;
      }

      const result = await git.client.getDiffPatch(
        file,
        section,
        section === "compare" ? git.compareState?.baseRef : undefined,
        section === "compare" ? git.compareState?.targetRef : undefined,
        section === "compare" ? git.compareState?.mode : undefined,
      );

      if (requestId !== diffLoadRequestRef.current) return;

      setDiffContent(result || "No changes");
      setUnsupportedReason(null);
      setIsLoading(false);
    })().catch((e) => {
      if (requestId !== diffLoadRequestRef.current) return;
      setDiffContent(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
      setUnsupportedReason(null);
      setIsLoading(false);
    });
  }, [
    git.client,
    git.compareState?.baseRef,
    git.compareState?.targetRef,
    git.compareState?.mode,
    selection.focusedFile,
    selection.selectedFile,
    selection.selectedFileSection,
  ]);

  useLayoutEffect(() => {
    loadDiff();
  }, [loadDiff]);

  const value = useMemo<ReviewDiffState>(
    () => ({
      diffContent,
      unsupportedReason,
      isLoading,
      diffViewMode,
      toggleDiffViewMode: () =>
        setDiffViewMode((mode) => (mode === "unified" ? "split" : "unified")),
    }),
    [diffContent, diffViewMode, isLoading, unsupportedReason],
  );

  return <ReviewDiffContext.Provider value={value}>{children}</ReviewDiffContext.Provider>;
}

export function useReviewDiff() {
  const ctx = useContext(ReviewDiffContext);
  if (!ctx) throw new Error("useReviewDiff must be used within ReviewDiffProvider");
  return ctx;
}
