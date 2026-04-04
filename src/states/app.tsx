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

import type { GitStatusFile } from "../git";
import { getFileDiffWithContext } from "../git";
import {
  firstAvailableFile,
  sectionForIndex,
  stagedFileCount,
  useGit,
  visibleFiles,
} from "./git";

// ---------------------------------------------------------------------------
// Types (app scope)
// ---------------------------------------------------------------------------

export type DiffViewMode = "unified" | "split";
export type FileSection = "staged" | "changes";
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
): FileKey | null {
  const file = focusedFileFromIndex(files, focusedRowIndex);
  if (!file) return null;
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
// Types
// ---------------------------------------------------------------------------

export type AppStateContextValue = {
  selectedFile: string | null;
  selectedFileKey: string | null;
  selectedFileSection: FileSection | null;
  diffContent: string | null;
  getScrollPosition: (key: string) => number;
  setScrollPosition: (key: string, value: number) => void;
  focusedRowIndex: number;
  focusedFileKey: string | null;
  visibleFiles: GitStatusFile[];
  focusedFile: GitStatusFile | null;
  diffViewMode: DiffViewMode;
  toggleDiffViewMode: () => void;
  selectFile: (filePath: string, section?: FileSection) => void;
  focusPreviousRow: () => void;
  focusNextRow: () => void;
  stageSelectedFile: () => void;
  unstageSelectedFile: () => void;
  discardSelectedFile: () => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AppStateContext = createContext<AppStateContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const git = useGit();

  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileSection, setSelectedFileSection] = useState<FileSection | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);
  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>("unified");
  const scrollPositionsRef = useRef(new Map<string, number>());

  // Derived state
  const status = git.status;
  const files = useMemo(() => visibleFiles(status), [status]);
  const stagedCount = useMemo(() => stagedFileCount(status), [status]);

  // -- file loading --
  const loadDiff = useCallback(
    (filePath: string, section: FileSection | null) => {
      try {
        if (!status) {
          setDiffContent(null);
          return;
        }
        const isStaged = section === "staged";
        const diff = getFileDiffWithContext(filePath, { staged: isStaged });
        setDiffContent(diff || "No content to display");
      } catch (e) {
        setDiffContent(
          `Error loading file: ${e instanceof Error ? e.message : "Unknown error"}`,
        );
      }
    },
    [status],
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
      const section = sectionForIndex(nextIndex, stagedCount);
      setFocusedRowIndex(nextIndex);
      if (file) selectFile(file.path, section);
    },
    [files, stagedCount, selectFile],
  );

  const toggleDiffViewMode = useCallback(() => {
    setDiffViewMode((current) => (current === "unified" ? "split" : "unified"));
  }, []);

  // Auto-select first file when status changes
  useEffect(() => {
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
  }, [selectedFile, status, files, loadDiff]);

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
  const value = useMemo<AppStateContextValue>(
    () => ({
      selectedFile,
      selectedFileKey: selectedFileKey(selectedFile, selectedFileSection),
      selectedFileSection,
      diffContent,
      getScrollPosition: (key) => scrollPositionsRef.current.get(key) ?? 0,
      setScrollPosition: (key, value) => {
        scrollPositionsRef.current.set(key, value);
      },
      focusedRowIndex,
      focusedFileKey: focusedFileKey(files, focusedRowIndex, stagedCount),
      visibleFiles: files,
      focusedFile: focusedFileFromIndex(files, focusedRowIndex),
      diffViewMode,
      toggleDiffViewMode,
      selectFile,
      focusPreviousRow: () => focusRow(nextFocusIndex(focusedRowIndex, -1, files.length)),
      focusNextRow: () => focusRow(nextFocusIndex(focusedRowIndex, 1, files.length)),
      stageSelectedFile: () => {
        if (selectedFile) git.stageFile(selectedFile);
      },
      unstageSelectedFile: () => {
        if (selectedFile) git.unstageFile(selectedFile);
      },
      discardSelectedFile: () => {
        if (selectedFile) git.discardChanges(selectedFile);
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
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
}
