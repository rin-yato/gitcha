import { flushSync } from "@opentui/react";

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

import type { GitStatusFile } from "@/lib/git";

import { useReviewSession } from "../session/session";
import type { ViewMode } from "../view";
import {
  buildFileKey,
  clampIndex,
  type FileSection,
  fileAtIndex,
  fileKeyFromIndex,
  indexOfFileInSection,
  sectionForIndex,
} from "./utils";

export type SelectionSource = "keyboard" | "mouse" | "programmatic";

export type ReviewSelectionState = {
  selectedFile: string | null;
  selectedFileKey: string | null;
  selectedFileSection: FileSection | null;
  selectedFileInfo: GitStatusFile | null;
  focusedRowIndex: number;
  focusedFileKey: string | null;
  selectionSource: SelectionSource;
  visibleFiles: GitStatusFile[];
  focusedFile: GitStatusFile | null;
  getScrollPosition: (key: string) => number;
  setScrollPosition: (key: string, value: number) => void;
  selectFile: (path: string, section?: FileSection) => void;
  focusPreviousRow: () => void;
  focusNextRow: () => void;
  stageSelectedFile: () => void;
  unstageSelectedFile: () => void;
  discardSelectedFile: () => void;
};

const ReviewSelectionContext = createContext<ReviewSelectionState | null>(null);

export function ReviewSelectionProvider({ children }: { children: React.ReactNode }) {
  const git = useReviewSession();

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);
  const [selectionSource, setSelectionSource] = useState<SelectionSource>("programmatic");
  const scrollPositionsRef = useRef(new Map<string, number>());

  const viewMode: ViewMode = git.compareState ? "compare" : "staging";
  const { fileTrees } = git;

  const fileTreeFiles = useMemo(
    () =>
      viewMode === "compare"
        ? fileTrees.compare.orderedFiles
        : [...fileTrees.staged.orderedFiles, ...fileTrees.changes.orderedFiles],
    [fileTrees, viewMode],
  );

  const sidebarFiles = fileTreeFiles;

  const stagedCount = useMemo(
    () => (viewMode === "compare" ? 0 : fileTrees.staged.orderedFiles.length),
    [fileTrees.staged.orderedFiles.length, viewMode],
  );

  const focusedFile = useMemo(
    () => fileAtIndex(sidebarFiles, focusedRowIndex),
    [focusedRowIndex, sidebarFiles],
  );

  const selectedFileInfo = useMemo(
    () => (selectedIndex !== null ? (sidebarFiles[selectedIndex] ?? null) : null),
    [selectedIndex, sidebarFiles],
  );

  const focusedFileKey = useMemo(
    () => fileKeyFromIndex(sidebarFiles, focusedRowIndex, stagedCount, viewMode),
    [focusedRowIndex, sidebarFiles, stagedCount, viewMode],
  );

  const selectedFile = useMemo(
    () => (selectedIndex !== null ? (sidebarFiles[selectedIndex]?.path ?? null) : null),
    [selectedIndex, sidebarFiles],
  );

  const selectedFileSection = useMemo(
    () =>
      selectedIndex !== null
        ? viewMode === "compare"
          ? "compare"
          : sectionForIndex(selectedIndex, stagedCount)
        : null,
    [selectedIndex, stagedCount, viewMode],
  );

  const selectedFileKey = useMemo(
    () =>
      selectedIndex !== null && selectedFile && selectedFileSection
        ? buildFileKey(selectedFileSection, selectedFile)
        : null,
    [selectedIndex, selectedFile, selectedFileSection],
  );

  const selectFile = useCallback(
    (path: string, section: FileSection = "changes") => {
      const idx = indexOfFileInSection(sidebarFiles, path, section, stagedCount, viewMode);
      if (idx === -1) return;

      flushSync(() => {
        setSelectedIndex(idx);
        setFocusedRowIndex(idx);
        setSelectionSource("mouse");
      });
    },
    [sidebarFiles, stagedCount, viewMode],
  );

  const focusPreviousRow = useCallback(() => {
    const nextIndex = clampIndex(focusedRowIndex - 1, sidebarFiles.length);
    flushSync(() => {
      setFocusedRowIndex(nextIndex);
      setSelectedIndex(nextIndex);
      setSelectionSource("keyboard");
    });
  }, [focusedRowIndex, sidebarFiles.length]);

  const focusNextRow = useCallback(() => {
    const nextIndex = clampIndex(focusedRowIndex + 1, sidebarFiles.length);
    flushSync(() => {
      setFocusedRowIndex(nextIndex);
      setSelectedIndex(nextIndex);
      setSelectionSource("keyboard");
    });
  }, [focusedRowIndex, sidebarFiles.length]);

  useLayoutEffect(() => {
    if (sidebarFiles.length === 0) {
      if (selectedIndex !== null || focusedRowIndex !== 0) {
        flushSync(() => {
          setSelectedIndex(null);
          setFocusedRowIndex(0);
          setSelectionSource("programmatic");
        });
      }
      return;
    }

    if (selectedIndex !== null && selectedIndex < sidebarFiles.length) return;

    flushSync(() => {
      setSelectedIndex(0);
      setFocusedRowIndex(0);
      setSelectionSource("programmatic");
    });
  }, [focusedRowIndex, selectedIndex, sidebarFiles.length]);

  const value = useMemo<ReviewSelectionState>(
    () => ({
      selectedFile,
      selectedFileKey,
      selectedFileSection,
      selectedFileInfo,
      focusedRowIndex,
      focusedFileKey,
      selectionSource,
      visibleFiles: sidebarFiles,
      focusedFile,
      getScrollPosition: (k) => scrollPositionsRef.current.get(k) ?? 0,
      setScrollPosition: (k, v) => scrollPositionsRef.current.set(k, v),
      selectFile,
      focusPreviousRow,
      focusNextRow,
      stageSelectedFile: () => {
        if (selectedFile && viewMode === "staging") git.stageFile(selectedFile);
      },
      unstageSelectedFile: () => {
        if (selectedFile && viewMode === "staging") git.unstageFile(selectedFile);
      },
      discardSelectedFile: () => {
        if (selectedFile && viewMode === "staging") git.discardChanges(selectedFile);
      },
    }),
    [
      selectedFile,
      selectedFileKey,
      selectedFileSection,
      selectedFileInfo,
      focusedRowIndex,
      focusedFileKey,
      selectionSource,
      sidebarFiles,
      focusedFile,
      selectFile,
      focusPreviousRow,
      focusNextRow,
      git,
      viewMode,
    ],
  );

  return (
    <ReviewSelectionContext.Provider value={value}>{children}</ReviewSelectionContext.Provider>
  );
}

export function useReviewSelection() {
  const ctx = useContext(ReviewSelectionContext);
  if (!ctx) throw new Error("useReviewSelection must be used within ReviewSelectionProvider");
  return ctx;
}
