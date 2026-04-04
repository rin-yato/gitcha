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

import type { CompareTarget, GitStatusFile } from "./git";
import {
  firstAvailableFile,
  sectionForIndex,
  stagedFileCount,
  visibleFiles as stagingVisibleFiles,
  useReviewSession,
} from "./session";

// ---------------------------------------------------------------------------
// Types (app scope)
// ---------------------------------------------------------------------------

export type DiffViewMode = "unified" | "split";
export type FileSection = "staged" | "changes" | "compare";
export type ViewMode = "staging" | "compare";
export type FileKey = `${FileSection}:${string}`;

// ---------------------------------------------------------------------------
// Pure helpers (app scope)
// ---------------------------------------------------------------------------

export function buildFileKey(section: FileSection, path: string): FileKey {
  return `${section}:${path}`;
}

export function focusedFileFromIndex(
  files: GitStatusFile[],
  focusedRowIndex: number,
): GitStatusFile | null {
  return files[focusedRowIndex] ?? null;
}

export function focusedFileKey(
  files: GitStatusFile[],
  focusedRowIndex: number,
  stagedCount: number,
  viewMode: ViewMode,
): FileKey | null {
  const file = focusedFileFromIndex(files, focusedRowIndex);
  if (!file) return null;
  if (viewMode === "compare") return buildFileKey("compare", file.path);
  return buildFileKey(sectionForIndex(focusedRowIndex, stagedCount), file.path);
}

export function selectedFileKey(
  selectedFile: string | null,
  selectedFileSection: FileSection | null,
): FileKey | null {
  if (!selectedFile || !selectedFileSection) return null;
  return buildFileKey(selectedFileSection, selectedFile);
}

export function clampFocusIndex(index: number, fileCount: number): number {
  if (fileCount === 0) return 0;
  return Math.max(0, Math.min(index, fileCount - 1));
}

export function nextFocusIndex(
  currentIndex: number,
  direction: -1 | 1,
  fileCount: number,
): number {
  if (fileCount === 0) return 0;
  return clampFocusIndex(currentIndex + direction, fileCount);
}

export function indexOfFile(files: GitStatusFile[], filePath: string): number {
  return files.findIndex((file) => file.path === filePath);
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

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
  branchPickerOpen: boolean;
  toggleViewMode: () => void;
  enterCompareMode: () => void;
  exitCompareMode: () => void;
  selectCompareBranch: (target: CompareTarget) => void;
  // File actions
  selectFile: (filePath: string, section?: FileSection) => void;
  focusPreviousRow: () => void;
  focusNextRow: () => void;
  stageSelectedFile: () => void;
  unstageSelectedFile: () => void;
  discardSelectedFile: () => void;
};

const ReviewStateContext = createContext<ReviewState | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ReviewStateProvider({ children }: { children: React.ReactNode }) {
  const git = useReviewSession();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileSection, setSelectedFileSection] = useState<FileSection | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);
  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>("unified");
  const [viewMode, setViewMode] = useState<ViewMode>("staging");
  const [branchPickerOpen, setBranchPickerOpen] = useState(false);
  const scrollPositionsRef = useRef(new Map<string, number>());

  // Derived state
  const status = git.status;
  const compareState = git.compareState;

  // Visible files depends on view mode
  const files = useMemo(() => {
    if (viewMode === "compare" && compareState) return compareState.files;
    return stagingVisibleFiles(status);
  }, [viewMode, compareState, status]);

  const stagedCount = useMemo(
    () => (viewMode === "compare" ? 0 : stagedFileCount(status)),
    [viewMode, status],
  );

  // -- file loading --
  const loadDiff = useCallback(
    (filePath: string, section: FileSection | null) => {
      try {
        if (viewMode === "compare" && compareState) {
          const diff = git.client.getFileDiffWithContext(filePath, {
            baseRef: compareState.baseRef,
          });
          setDiffContent(diff || "No changes to display");
          return;
        }

        if (!status) {
          setDiffContent(null);
          return;
        }
        const isStaged = section === "staged";
        const diff = git.client.getFileDiffWithContext(filePath, { staged: isStaged });
        setDiffContent(diff || "No content to display");
      } catch (e) {
        setDiffContent(
          `Error loading file: ${e instanceof Error ? e.message : "Unknown error"}`,
        );
      }
    },
    [status, viewMode, compareState, git.client],
  );

  const selectFile = useCallback(
    (filePath: string, section: FileSection = "changes") => {
      setSelectedFile(filePath);
      setSelectedFileSection(section);
      loadDiff(filePath, section);
    },
    [loadDiff],
  );

  const focusRow = useCallback(
    (nextIndex: number) => {
      const file = files[nextIndex];
      const section =
        viewMode === "compare" ? "compare" : sectionForIndex(nextIndex, stagedCount);
      setFocusedRowIndex(nextIndex);
      if (file) selectFile(file.path, section);
    },
    [files, stagedCount, selectFile, viewMode],
  );

  const toggleDiffViewMode = useCallback(() => {
    setDiffViewMode((current) => (current === "unified" ? "split" : "unified"));
  }, []);

  const toggleViewMode = useCallback(() => {
    if (viewMode === "staging") {
      const target = git.defaultCompareTarget;
      if (target) {
        const nextState = git.startCompare(target);
        if (nextState?.files[0]) {
          setSelectedFile(nextState.files[0].path);
          setSelectedFileSection("compare");
          setDiffContent(
            git.client.getFileDiffWithContext(nextState.files[0].path, {
              baseRef: nextState.baseRef,
            }),
          );
        }
      }
      setViewMode("compare");
      setBranchPickerOpen(false);
    } else {
      setBranchPickerOpen((open) => !open);
    }
  }, [viewMode, git]);

  const enterCompareMode = useCallback(() => {
    setViewMode("compare");
    setBranchPickerOpen(false);
    setSelectedFile(null);
    setSelectedFileSection(null);
    setDiffContent(null);
  }, []);

  const exitCompareMode = useCallback(() => {
    git.stopCompare();
    setViewMode("staging");
    setBranchPickerOpen(false);
    setSelectedFile(null);
    setSelectedFileSection(null);
    setDiffContent(null);
  }, [git]);

  const selectCompareBranch = useCallback(
    (target: CompareTarget) => {
      const nextState = git.startCompare(target);
      setBranchPickerOpen(false);
      if (nextState?.files[0]) {
        setSelectedFile(nextState.files[0].path);
        setSelectedFileSection("compare");
        setDiffContent(
          git.client.getFileDiffWithContext(nextState.files[0].path, {
            baseRef: nextState.baseRef,
          }),
        );
      }
    },
    [git],
  );

  // Auto-select first file when files change
  useEffect(() => {
    if (viewMode === "compare") {
      const first = files[0];
      if (!first) {
        setSelectedFile(null);
        setSelectedFileSection(null);
        setDiffContent(null);
        return;
      }

      if (selectedFile !== first.path || selectedFileSection !== "compare") {
        setSelectedFile(first.path);
        setSelectedFileSection("compare");
        loadDiff(first.path, "compare");
      }

      return;
    }

    // Staging mode
    if (files.length > 0 && !selectedFile) {
      const first = firstAvailableFile(status);
      if (first) {
        setSelectedFile(first.path);
        setSelectedFileSection(first.section);
        loadDiff(first.path, first.section);
      }
    } else if (files.length === 0 && selectedFile) {
      setSelectedFile(null);
      setSelectedFileSection(null);
      setDiffContent(null);
    }
  }, [selectedFile, selectedFileSection, status, files, loadDiff, viewMode]);

  // Clamp focus index when files change
  useEffect(() => {
    setFocusedRowIndex((prev) => clampFocusIndex(prev, files.length));
  }, [files]);

  // Track focus index with selected file
  useEffect(() => {
    if (!selectedFile || files.length === 0) return;
    const idx = indexOfFile(files, selectedFile);
    if (idx !== -1 && focusedRowIndex !== idx) {
      setFocusedRowIndex(idx);
    }
  }, [focusedRowIndex, selectedFile, files]);

  // -- context value --
  const value = useMemo<ReviewState>(
    () => ({
      selectedFile,
      selectedFileKey: selectedFileKey(selectedFile, selectedFileSection),
      selectedFileSection,
      diffContent,
      getScrollPosition: (key: string) => scrollPositionsRef.current.get(key) ?? 0,
      setScrollPosition: (key: string, value: number) => {
        scrollPositionsRef.current.set(key, value);
      },
      focusedRowIndex,
      focusedFileKey: focusedFileKey(files, focusedRowIndex, stagedCount, viewMode),
      visibleFiles: files,
      focusedFile: focusedFileFromIndex(files, focusedRowIndex),
      diffViewMode,
      toggleDiffViewMode,
      viewMode,
      branchPickerOpen,
      toggleViewMode,
      enterCompareMode,
      exitCompareMode,
      selectCompareBranch,
      selectFile,
      focusPreviousRow: () => focusRow(nextFocusIndex(focusedRowIndex, -1, files.length)),
      focusNextRow: () => focusRow(nextFocusIndex(focusedRowIndex, 1, files.length)),
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
      diffContent,
      diffViewMode,
      files,
      focusRow,
      focusedRowIndex,
      git,
      selectFile,
      selectedFile,
      selectedFileSection,
      stagedCount,
      toggleDiffViewMode,
      viewMode,
      branchPickerOpen,
      toggleViewMode,
      enterCompareMode,
      exitCompareMode,
      selectCompareBranch,
    ],
  );

  return <ReviewStateContext.Provider value={value}>{children}</ReviewStateContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useReviewState() {
  const context = useContext(ReviewStateContext);
  if (!context) {
    throw new Error("useReviewState must be used within a ReviewStateProvider");
  }
  return context;
}
