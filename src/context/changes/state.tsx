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

import type { CompareTarget, GitStatusFile } from "../../git";
import { generateDiff } from "../../git";
import {
  firstAvailableFile,
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

export type ReviewState = {
  // Selection
  selectedFile: string | null;
  selectedFileKey: string | null;
  selectedFileSection: FileSection | null;
  diffContent: string | null;
  // Scroll
  getScrollPosition: (key: string) => number;
  setScrollPosition: (key: string, value: number) => void;
  // Focus / navigation
  focusedRowIndex: number;
  focusedFileKey: string | null;
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
  sidebarWidth: number;
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
  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>("unified");
  const [viewMode, setViewMode] = useState<ViewMode>("staging");
  const [sidebarWidth, setSidebarWidth] = useState(40);
  const scrollPositionsRef = useRef(new Map<string, number>());
  const hasInitializedRef = useRef(false);

  // -- derived state --
  const status = git.status;
  const compareState = git.compareState;

  const files = useMemo(() => {
    if (viewMode === "compare" && compareState) return compareState.files;
    return stagingVisibleFiles(status);
  }, [viewMode, compareState, status]);

  const stagedCount = useMemo(
    () => (viewMode === "compare" ? 0 : stagedFileCount(status)),
    [viewMode, status],
  );

  const focusedFile = useMemo(
    () => fileAtIndex(files, focusedRowIndex),
    [files, focusedRowIndex],
  );

  const focusedFileKey = useMemo(
    () => fileKeyFromIndex(files, focusedRowIndex, stagedCount, viewMode),
    [files, focusedRowIndex, stagedCount, viewMode],
  );

  const selectedFile = useMemo(
    () => (selectedIndex !== null ? (files[selectedIndex]?.path ?? null) : null),
    [files, selectedIndex],
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
    (file: GitStatusFile, section: FileSection | null) => {
      if (!section) {
        setDiffContent(null);
        return;
      }

      const compareBaseRef =
        viewMode === "compare" && compareState ? compareState.baseRef : undefined;

      git.client
        .loadDiffSource(file, section, compareBaseRef)
        .then((source) => {
          const diff = generateDiff(source, file.path);
          setDiffContent(diff || "No changes");
        })
        .catch((e) => {
          setDiffContent(`Error: ${e instanceof Error ? e.message : "Unknown"}`);
        });
    },
    [viewMode, compareState, git.client],
  );

  // -- selection actions --
  const selectFile = useCallback(
    (path: string, section: FileSection = "changes") => {
      const idx = indexOfFileInSection(files, path, section, stagedCount, viewMode);
      if (idx !== -1) {
        setSelectedIndex(idx);
        setFocusedRowIndex(idx);
        const file = files[idx];
        if (file) loadDiff(file, section);
      }
    },
    [files, loadDiff, stagedCount, viewMode],
  );

  const _focusRow = useCallback(
    (nextIndex: number) => {
      const clamped = clampIndex(nextIndex, files.length);
      setFocusedRowIndex(clamped);
    },
    [files.length],
  );

  const focusPreviousRow = useCallback(() => {
    const nextIndex = clampIndex(focusedRowIndex - 1, files.length);
    setFocusedRowIndex(nextIndex);
    setSelectedIndex(nextIndex);
    const file = files[nextIndex];
    const section =
      viewMode === "compare" ? "compare" : sectionForIndex(nextIndex, stagedCount);
    if (file) loadDiff(file, section);
  }, [focusedRowIndex, files, stagedCount, viewMode, loadDiff]);

  const focusNextRow = useCallback(() => {
    const nextIndex = clampIndex(focusedRowIndex + 1, files.length);
    setFocusedRowIndex(nextIndex);
    setSelectedIndex(nextIndex);
    const file = files[nextIndex];
    const section =
      viewMode === "compare" ? "compare" : sectionForIndex(nextIndex, stagedCount);
    if (file) loadDiff(file, section);
  }, [focusedRowIndex, files, stagedCount, viewMode, loadDiff]);

  // -- view mode actions --
  const enterCompareMode = useCallback(
    (target: CompareTarget) => {
      git.startCompare(target).then((nextState) => {
        setViewMode("compare");
        setSelectedIndex(null);
        setDiffContent(null);
        setFocusedRowIndex(0);
        if (nextState?.files[0]) {
          setSelectedIndex(0);
          setFocusedRowIndex(0);
          loadDiff(nextState.files[0], "compare");
        }
      });
    },
    [git, loadDiff],
  );

  const exitCompareMode = useCallback(() => {
    git.stopCompare();
    setViewMode("staging");
    setSelectedIndex(null);
    setDiffContent(null);
    setFocusedRowIndex(0);
  }, [git]);

  const selectCompareBranch = useCallback(
    (target: CompareTarget) => {
      git.startCompare(target).then((nextState) => {
        const first = nextState?.files[0];
        if (first) {
          setSelectedIndex(0);
          setFocusedRowIndex(0);
          loadDiff(first, "compare");
        }
      });
    },
    [git, loadDiff],
  );

  // -- layout actions --
  const toggleDiffViewMode = useCallback(() => {
    setDiffViewMode((m) => (m === "unified" ? "split" : "unified"));
  }, []);

  const shrinkSidebar = useCallback(() => {
    setSidebarWidth((w) => Math.max(MIN_SIDEBAR_WIDTH, w - 5));
  }, []);

  const growSidebar = useCallback(() => {
    setSidebarWidth((w) => Math.min(MAX_SIDEBAR_WIDTH, w + 5));
  }, []);

  // -- effects --

  // Initialize: auto-select first file on first load
  useEffect(() => {
    if (hasInitializedRef.current) return;
    if (!files.length) return;

    hasInitializedRef.current = true;

    const first = firstAvailableFile(status);
    if (first) {
      const idx = indexOfFileInSection(files, first.path, first.section, stagedCount, viewMode);
      if (idx !== -1) {
        setSelectedIndex(idx);
        setFocusedRowIndex(idx);
        loadDiff({ path: first.path } as GitStatusFile, first.section);
      }
    }
  }, [files.length, status, loadDiff, files, stagedCount, viewMode]);

  // Handle empty state: clear selection when no files
  useEffect(() => {
    if (files.length === 0) {
      setSelectedIndex(null);
      setDiffContent(null);
      setFocusedRowIndex(0);
    }
  }, [files.length]);

  // -- context value --
  const value = useMemo<ReviewState>(
    () => ({
      selectedFile,
      selectedFileKey,
      selectedFileSection,
      diffContent,
      getScrollPosition: (k) => scrollPositionsRef.current.get(k) ?? 0,
      setScrollPosition: (k, v) => scrollPositionsRef.current.set(k, v),
      focusedRowIndex,
      focusedFileKey,
      visibleFiles: files,
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
      sidebarWidth,
      shrinkSidebar,
      growSidebar,
    }),
    [
      selectedFile,
      selectedFileKey,
      selectedFileSection,
      diffContent,
      focusedRowIndex,
      focusedFileKey,
      files,
      focusedFile,
      diffViewMode,
      viewMode,
      enterCompareMode,
      exitCompareMode,
      selectCompareBranch,
      selectFile,
      focusPreviousRow,
      focusNextRow,
      sidebarWidth,
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
