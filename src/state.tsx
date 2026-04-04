import type React from "react";
import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

import type { GitRepoStatus, GitStatusFile } from "./git";
import {
  commitChanges as commitGitChanges,
  discardChanges as discardGitChanges,
  getFileDiffWithContext,
  getRecentCommits,
  getRepoStatus,
  pullChanges as pullGitChanges,
  pushChanges as pushGitChanges,
  stageFile as stageGitFile,
  unstageFile as unstageGitFile,
} from "./git";

export type DiffViewMode = "unified" | "split";
export type FileSection = "staged" | "changes";

type GitContextValue = {
  status: GitRepoStatus | null;
  error: string | null;
  commits: string[];
  refreshStatus: () => void;
  refreshCommits: () => void;
  stageFile: (filePath: string) => void;
  unstageFile: (filePath: string) => void;
  discardChanges: (filePath: string) => void;
  commitChanges: (message: string) => void;
  pushChanges: () => void;
  pullChanges: () => void;
};

const GitContext = createContext<GitContextValue | null>(null);

export function GitProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GitRepoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState<string[]>([]);

  const refreshStatus = () => {
    try {
      setStatus(getRepoStatus());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git status");
      setStatus(null);
    }
  };

  const refreshCommits = () => {
    try {
      setCommits(getRecentCommits());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git log");
      setCommits([]);
    }
  };

  const runGitAction = (action: () => void) => {
    try {
      action();
      refreshStatus();
      refreshCommits();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Git action failed");
    }
  };

  useEffect(() => {
    refreshStatus();
    refreshCommits();

    const statusTimer = setInterval(refreshStatus, 2000);
    const commitsTimer = setInterval(refreshCommits, 5000);

    return () => {
      clearInterval(statusTimer);
      clearInterval(commitsTimer);
    };
  }, []);

  const value = useMemo<GitContextValue>(
    () => ({
      status,
      error,
      commits,
      refreshStatus,
      refreshCommits,
      stageFile: (filePath) => runGitAction(() => stageGitFile(filePath)),
      unstageFile: (filePath) => runGitAction(() => unstageGitFile(filePath)),
      discardChanges: (filePath) => runGitAction(() => discardGitChanges(filePath)),
      commitChanges: (message) => runGitAction(() => commitGitChanges(message)),
      pushChanges: () => runGitAction(() => pushGitChanges()),
      pullChanges: () => runGitAction(() => pullGitChanges()),
    }),
    [commits, error, status],
  );

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>;
}

export function useGit() {
  const context = useContext(GitContext);
  if (!context) {
    throw new Error("useGit must be used within a GitProvider");
  }
  return context;
}

type AppStateContextValue = {
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

const AppStateContext = createContext<AppStateContextValue | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const git = useGit();
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [selectedFileSection, setSelectedFileSection] = useState<FileSection | null>(null);
  const [diffContent, setDiffContent] = useState<string | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = useState(0);
  const [diffViewMode, setDiffViewMode] = useState<DiffViewMode>("unified");
  const scrollPositionsRef = useRef(new Map<string, number>());

  const status = git.status;
  const visibleFiles = useMemo(() => {
    if (!status) return [] as GitStatusFile[];
    return [...status.files.staged, ...status.files.changes];
  }, [status]);

  const stagedFileCount = status?.files.staged.length ?? 0;
  const focusedFile = visibleFiles[focusedRowIndex] ?? null;
  const selectedFileKey =
    selectedFile && selectedFileSection ? `${selectedFileSection}:${selectedFile}` : null;
  const focusedFileKey = focusedFile
    ? `${focusedRowIndex < stagedFileCount ? "staged" : "changes"}:${focusedFile.path}`
    : null;

  const loadFile = (filePath: string, section: FileSection | null) => {
    try {
      if (!status) {
        setDiffContent(null);
        return;
      }

      const isStaged = section === "staged";
      const diff = getFileDiffWithContext(filePath, { staged: isStaged });
      setDiffContent(diff || "No content to display");
    } catch (e) {
      setDiffContent(`Error loading file: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  };

  const selectFile = (filePath: string, section: FileSection = "changes") => {
    setSelectedFile(filePath);
    setSelectedFileSection(section);
    loadFile(filePath, section);
  };

  const focusRow = (nextIndex: number) => {
    const file = visibleFiles[nextIndex];
    const section: FileSection = nextIndex < stagedFileCount ? "staged" : "changes";
    setFocusedRowIndex(nextIndex);

    if (file) {
      selectFile(file.path, section);
    }
  };

  useEffect(() => {
    const files = visibleFiles;
    if (files.length > 0 && !selectedFile) {
      const first = status?.files.staged[0] ?? status?.files.changes[0] ?? null;
      const firstSection: FileSection = status?.files.staged.length ? "staged" : "changes";

      if (first) {
        setSelectedFile(first.path);
        setSelectedFileSection(firstSection);
        loadFile(first.path, firstSection);
      }
    } else if (files.length === 0) {
      setSelectedFile(null);
      setSelectedFileSection(null);
      setDiffContent(null);
    }
  }, [selectedFile, status, visibleFiles]);

  useEffect(() => {
    if (visibleFiles.length === 0) {
      if (focusedRowIndex !== 0) {
        setFocusedRowIndex(0);
      }
      return;
    }

    if (focusedRowIndex >= visibleFiles.length) {
      setFocusedRowIndex(Math.max(0, visibleFiles.length - 1));
    }
  }, [focusedRowIndex, visibleFiles]);

  useEffect(() => {
    if (!selectedFile || visibleFiles.length === 0) return;

    const nextIndex = visibleFiles.findIndex((file) => file.path === selectedFile);
    if (nextIndex !== -1 && focusedRowIndex !== nextIndex) {
      setFocusedRowIndex(nextIndex);
    }
  }, [focusedRowIndex, selectedFile, visibleFiles]);

  const value = useMemo<AppStateContextValue>(
    () => ({
      selectedFile,
      selectedFileKey,
      selectedFileSection,
      diffContent,
      getScrollPosition: (key) => scrollPositionsRef.current.get(key) ?? 0,
      setScrollPosition: (key, value) => {
        scrollPositionsRef.current.set(key, value);
      },
      focusedRowIndex,
      focusedFileKey,
      visibleFiles,
      focusedFile,
      diffViewMode,
      toggleDiffViewMode: () =>
        setDiffViewMode((current) => (current === "unified" ? "split" : "unified")),
      selectFile,
      focusPreviousRow: () => focusRow(Math.max(0, focusedRowIndex - 1)),
      focusNextRow: () => focusRow(Math.min(visibleFiles.length - 1, focusedRowIndex + 1)),
      stageSelectedFile: () => {
        const file = selectedFile;
        if (file) git.stageFile(file);
      },
      unstageSelectedFile: () => {
        const file = selectedFile;
        if (file) git.unstageFile(file);
      },
      discardSelectedFile: () => {
        const file = selectedFile;
        if (file) git.discardChanges(file);
      },
    }),
    [
      diffContent,
      diffViewMode,
      focusedFile,
      focusedFileKey,
      focusedRowIndex,
      git,
      selectedFile,
      selectedFileKey,
      selectedFileSection,
      status,
      visibleFiles,
    ],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
}
