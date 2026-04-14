import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { generateDiff } from "@/lib/git";

import { useReviewSelection } from "../selection";
import { useReviewSession } from "../session/session";

export type DiffViewMode = "unified" | "split";

export type ReviewDiffState = {
  diffContent: string | null;
  diffViewMode: DiffViewMode;
  toggleDiffViewMode: () => void;
};

const ReviewDiffContext = createContext<ReviewDiffState | null>(null);

export function ReviewDiffProvider({ children }: { children: React.ReactNode }) {
  const git = useReviewSession();
  const selection = useReviewSelection();
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [diffViewMode, setDiffViewMode] = useState<ReviewDiffState["diffViewMode"]>("unified");
  const diffLoadRequestRef = useRef(0);

  const loadDiff = useCallback(() => {
    if (!selection.selectedFile || !selection.selectedFileSection) {
      setDiffContent(null);
      return;
    }

    const requestId = ++diffLoadRequestRef.current;
    const compareBaseRef =
      selection.selectedFileSection === "compare" ? git.compareState?.baseRef : undefined;

    const file = selection.focusedFile;
    if (!file) {
      setDiffContent(null);
      return;
    }

    git.client
      .loadDiffSource(file, selection.selectedFileSection, compareBaseRef)
      .then((source) => {
        if (requestId !== diffLoadRequestRef.current) return;
        const diff = generateDiff(source, file.path);
        setDiffContent(diff || "No changes");
      })
      .catch((e) => {
        if (requestId !== diffLoadRequestRef.current) return;
        setDiffContent(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
      });
  }, [
    git.client,
    git.compareState?.baseRef,
    selection.focusedFile,
    selection.selectedFile,
    selection.selectedFileSection,
  ]);

  useEffect(() => {
    loadDiff();
  }, [loadDiff]);

  const value = useMemo<ReviewDiffState>(
    () => ({
      diffContent,
      diffViewMode,
      toggleDiffViewMode: () =>
        setDiffViewMode((mode) => (mode === "unified" ? "split" : "unified")),
    }),
    [diffContent, diffViewMode],
  );

  return <ReviewDiffContext.Provider value={value}>{children}</ReviewDiffContext.Provider>;
}

export function useReviewDiff() {
  const ctx = useContext(ReviewDiffContext);
  if (!ctx) throw new Error("useReviewDiff must be used within ReviewDiffProvider");
  return ctx;
}
