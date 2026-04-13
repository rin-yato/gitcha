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

import type { CompareTarget, GitStatusFile } from "@/lib/git";
import { generateDiff } from "@/lib/git";

import { getVisualFileOrder } from "@/component/sidebar/utils";

import {
  sectionForIndex,
  stagedFileCount,
  visibleFiles as stagingVisibleFiles,
  useReviewSession,
} from "./session";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type DiffViewMode = "unified" | "split";
export type FileSection = "staged" | "changes" | "compare";
export type ViewMode = "staging" | "compare";
export type FileKey = `${FileSection}:${string}`;
export type SelectionSource = "keyboard" | "mouse" | "programmatic";

export type ReviewState = {
  // Selection
  selectedFile: string | null;
  selectedFileKey: string | null;
  selectedFileSection: FileSection | null;
  selectedFileInfo: GitStatusFile | null;
  diffContent: string | null;
  // Scroll
  getScrollPosition: (key: string) => number;
  setScrollPosition: (key: string, value: number) => void;
  // Focus / navigation
  focusedRowIndex: number;
  focusedFileKey: string | null;
  selectionSource: SelectionSource;
  visibleFiles: GitStatusFile[];
  focusedFile: GitStatusFile | null;
  // Diff view
  diffViewMode: DiffViewMode;
  toggleDiffViewMode: () => void;
  // View mode (staging vs compare)
  viewMode: ViewMode;
  enterCompareMode: (target: CompareTarget) => void;
  exitCompareMode: () => void;
  selectCompareBranch: (target: CompareTarget) => void;
  // File actions
  selectFile: (path: string, section?: FileSection) => void;
  focusPreviousRow: () => void;
  focusNextRow: () => void;
  stageSelectedFile: () => void;
  unstageSelectedFile: () => void;
  discardSelectedFile: () => void;
  // Layout
  isSidebarOpen: boolean;
  sidebarWidth: number;
  toggleSidebar: () => void;
  shrinkSidebar: () => void;
  growSidebar: () => void;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_SIDEBAR_WIDTH = 20;
const MAX_SIDEBAR_WIDTH = 80;

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

export function buildFileKey(section: FileSection, path: string): FileKey {
  return `${section}:${path}`;
}

export function parseFileKey(key: string): { section: FileSection; path: string } | null {
  const colonIdx = key.indexOf(":");
  if (colonIdx === -1) return null;
  const section = key.slice(0, colonIdx) as FileSection;
  const path = key.slice(colonIdx + 1);
  if (!["staged", "changes", "compare"].includes(section)) return null;
  return { section, path };
}

export function clampIndex(index: number, count: number): number {
  if (count === 0) return 0;
  return Math.max(0, Math.min(index, count - 1));
}

export function wrapIndex(index: number, count: number): number {
  if (count === 0) return 0;
  return ((index % count) + count) % count;
}

export function fileAtIndex(files: GitStatusFile[], index: number): GitStatusFile | null {
  return files[index] ?? null;
}

export function indexOfFile(files: GitStatusFile[], path: string): number {
  return files.findIndex((f) => f.path === path);
}

export function indexOfFileInSection(
  files: GitStatusFile[],
  path: string,
  section: FileSection,
  stagedCount: number,
  viewMode: ViewMode,
): number {
  return files.findIndex((file, index) => {
    if (file.path !== path) return false;
    const currentSection =
      viewMode === "compare" ? "compare" : sectionForIndex(index, stagedCount);
    return currentSection === section;
  });
}

export function fileKeyFromIndex(
  files: GitStatusFile[],
  index: number,
  stagedCount: number,
  viewMode: ViewMode,
): FileKey | null {
  const file = fileAtIndex(files, index);
  if (!file) return null;
  const section = viewMode === "compare" ? "compare" : sectionForIndex(index, stagedCount);
  return buildFileKey(section, file.path);
}

export function sectionKey(section: FileSection, path: string): string {
  return buildFileKey(section, path);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ReviewStateContext = createContext<ReviewState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ReviewStateProvider({ children }: { children: React.ReactNode }) {
  const git = useReviewSession();

  // -- state --
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);
  const [selectionSource, setSelectionSource] = useState<SelectionSource>("programmatic");
  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>("unified");
  const [viewMode, setViewMode] = useState<ViewMode>("staging");
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(40);
  const previousSidebarWidthRef = useRef(40);
  const scrollPositionsRef = useRef(new Map<string, number>());
  const diffLoadRequestRef = useRef(0);

  // -- derived state --
  const status = git.status;
  const compareState = git.compareState;

  const sidebarFiles = useMemo(() => {
    if (viewMode === "compare") {
      return getVisualFileOrder(compareState?.files ?? []);
    }

    const stagedFiles = getVisualFileOrder(status?.files.staged ?? []);
    const changedFiles = getVisualFileOrder([
      ...(status?.files.changes ?? []),
      ...(status?.files.untracked ?? []),
    ]);

    return [...stagedFiles, ...changedFiles];
  }, [viewMode, compareState?.files, status]);

  const stagedCount = useMemo(
    () => (viewMode === "compare" ? 0 : stagedFileCount(status)),
    [viewMode, status],
  );

  const focusedFile = useMemo(
    () => fileAtIndex(sidebarFiles, focusedRowIndex),
    [sidebarFiles, focusedRowIndex],
  );

  const selectedFileInfo = useMemo(
    () => (selectedIndex !== null ? (sidebarFiles[selectedIndex] ?? null) : null),
    [sidebarFiles, selectedIndex],
  );

  const focusedFileKey = useMemo(
    () => fileKeyFromIndex(sidebarFiles, focusedRowIndex, stagedCount, viewMode),
    [sidebarFiles, focusedRowIndex, stagedCount, viewMode],
  );

  const selectedFile = useMemo(
    () => (selectedIndex !== null ? (sidebarFiles[selectedIndex]?.path ?? null) : null),
    [sidebarFiles, selectedIndex],
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

  // -- file loading --
  const loadDiff = useCallback(
    (file: GitStatusFile, section: FileSection | null, compareBaseRef?: string) => {
      if (!section) {
        setDiffContent(null);
        return;
      }

      const requestId = ++diffLoadRequestRef.current;
      const resolvedCompareBaseRef =
        section === "compare" ? (compareBaseRef ?? compareState?.baseRef) : undefined;

      git.client
        .loadDiffSource(file, section, resolvedCompareBaseRef)
        .then((source) => {
          if (requestId !== diffLoadRequestRef.current) return;
          const diff = generateDiff(source, file.path);
          setDiffContent(diff || "No changes");
        })
        .catch((e) => {
          if (requestId !== diffLoadRequestRef.current) return;
          setDiffContent(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
        });
    },
    [viewMode, compareState, git.client],
  );

  useLayoutEffect(() => {
    if (sidebarFiles.length === 0) {
      if (selectedIndex !== null || focusedRowIndex !== 0 || diffContent !== null) {
        flushSync(() => {
          setSelectedIndex(null);
          setFocusedRowIndex(0);
          setSelectionSource("programmatic");
          setDiffContent(null);
        });
      }
      return;
    }

    if (selectedIndex !== null && selectedIndex < sidebarFiles.length) return;

    const first = sidebarFiles[0];
    if (!first) return;

    flushSync(() => {
      setSelectedIndex(0);
      setFocusedRowIndex(0);
      setSelectionSource("programmatic");
    });

    const section = viewMode === "compare" ? "compare" : sectionForIndex(0, stagedCount);
    loadDiff(first, section, viewMode === "compare" ? compareState?.baseRef : undefined);
  }, [
    compareState?.baseRef,
    diffContent,
    sidebarFiles,
    focusedRowIndex,
    loadDiff,
    selectedIndex,
    stagedCount,
    viewMode,
  ]);

  // -- selection actions --
  const selectFile = useCallback(
    (path: string, section: FileSection = "changes") => {
      const idx = indexOfFileInSection(sidebarFiles, path, section, stagedCount, viewMode);
      if (idx !== -1) {
        flushSync(() => {
          setSelectedIndex(idx);
          setFocusedRowIndex(idx);
          setSelectionSource("mouse");
        });
        const file = sidebarFiles[idx];
        if (file) loadDiff(file, section);
      }
    },
    [sidebarFiles, loadDiff, stagedCount, viewMode],
  );

  const _focusRow = useCallback(
    (nextIndex: number) => {
      const clamped = clampIndex(nextIndex, sidebarFiles.length);
      setFocusedRowIndex(clamped);
    },
    [sidebarFiles.length],
  );

  const focusPreviousRow = useCallback(() => {
    const nextIndex = clampIndex(focusedRowIndex - 1, sidebarFiles.length);
    flushSync(() => {
      setFocusedRowIndex(nextIndex);
      setSelectedIndex(nextIndex);
      setSelectionSource("keyboard");
    });
    const file = sidebarFiles[nextIndex];
    const section =
      viewMode === "compare" ? "compare" : sectionForIndex(nextIndex, stagedCount);
    if (file) loadDiff(file, section);
  }, [focusedRowIndex, sidebarFiles, stagedCount, viewMode, loadDiff]);

  const focusNextRow = useCallback(() => {
    const nextIndex = clampIndex(focusedRowIndex + 1, sidebarFiles.length);
    flushSync(() => {
      setFocusedRowIndex(nextIndex);
      setSelectedIndex(nextIndex);
      setSelectionSource("keyboard");
    });
    const file = sidebarFiles[nextIndex];
    const section =
      viewMode === "compare" ? "compare" : sectionForIndex(nextIndex, stagedCount);
    if (file) loadDiff(file, section);
  }, [focusedRowIndex, sidebarFiles, stagedCount, viewMode, loadDiff]);

  // -- view mode actions --
  const enterCompareMode = useCallback(
    (target: CompareTarget) => {
      git.startCompare(target).then((nextState) => {
        const first = getVisualFileOrder(nextState?.files ?? [])[0] ?? null;
        flushSync(() => {
          setViewMode("compare");
          setFocusedRowIndex(0);
          setSelectionSource("programmatic");
          setSelectedIndex(first ? 0 : null);
          setDiffContent(null);
        });

        if (first && nextState) {
          loadDiff(first, "compare", nextState.baseRef);
        }
      });
    },
    [git, loadDiff],
  );

  const exitCompareMode = useCallback(() => {
    git.stopCompare();
    const first = stagingVisibleFiles(status)[0] ?? null;

    flushSync(() => {
      setViewMode("staging");
      setFocusedRowIndex(0);
      setSelectionSource("programmatic");
      setSelectedIndex(first ? 0 : null);
      setDiffContent(null);
    });

    if (first) {
      const section = sectionForIndex(0, stagedFileCount(status));
      loadDiff(first, section);
    }
  }, [git, loadDiff, status]);

  const selectCompareBranch = useCallback(
    (target: CompareTarget) => {
      git.startCompare(target).then((nextState) => {
        const first = getVisualFileOrder(nextState?.files ?? [])[0] ?? null;
        flushSync(() => {
          setSelectedIndex(first ? 0 : null);
          setFocusedRowIndex(0);
          setSelectionSource("programmatic");
          setDiffContent(null);
        });

        if (first && nextState) {
          loadDiff(first, "compare", nextState.baseRef);
        }
      });
    },
    [git, loadDiff],
  );

  // -- layout actions --
  const toggleDiffViewMode = useCallback(() => {
    setDiffViewMode((m) => (m === "unified" ? "split" : "unified"));
  }, []);

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

  // -- context value --
  const value = useMemo<ReviewState>(
    () => ({
      selectedFile,
      selectedFileKey,
      selectedFileSection,
      selectedFileInfo,
      diffContent,
      getScrollPosition: (k) => scrollPositionsRef.current.get(k) ?? 0,
      setScrollPosition: (k, v) => scrollPositionsRef.current.set(k, v),
      focusedRowIndex,
      focusedFileKey,
      selectionSource,
      visibleFiles: sidebarFiles,
      focusedFile,
      diffViewMode,
      toggleDiffViewMode,
      viewMode,
      enterCompareMode,
      exitCompareMode,
      selectCompareBranch,
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
      isSidebarOpen,
      sidebarWidth,
      toggleSidebar,
      shrinkSidebar,
      growSidebar,
    }),
    [
      selectedFile,
      selectedFileKey,
      selectedFileSection,
      selectedFileInfo,
      diffContent,
      focusedRowIndex,
      focusedFileKey,
      selectionSource,
      sidebarFiles,
      focusedFile,
      diffViewMode,
      viewMode,
      enterCompareMode,
      exitCompareMode,
      selectCompareBranch,
      selectFile,
      focusPreviousRow,
      focusNextRow,
      isSidebarOpen,
      sidebarWidth,
      toggleSidebar,
      shrinkSidebar,
      growSidebar,
      git,
    ],
  );

  return <ReviewStateContext.Provider value={value}>{children}</ReviewStateContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReviewState() {
  const ctx = useContext(ReviewStateContext);
  if (!ctx) throw new Error("useReviewState must be used within ReviewStateProvider");
  return ctx;
}
