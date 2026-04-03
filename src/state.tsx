import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";

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
  status: () => GitRepoStatus | null;
  error: () => string | null;
  commits: () => string[];
  refreshStatus: () => void;
  refreshCommits: () => void;
  stageFile: (filePath: string) => void;
  unstageFile: (filePath: string) => void;
  discardChanges: (filePath: string) => void;
  commitChanges: (message: string) => void;
  pushChanges: () => void;
  pullChanges: () => void;
};

const GitContext = createContext<GitContextValue>();

export function GitProvider(props: { children: any }) {
  const [status, setStatus] = createSignal<GitRepoStatus | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [commits, setCommits] = createSignal<string[]>([]);

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

  onMount(() => {
    refreshStatus();
    refreshCommits();
    const timer = setInterval(refreshStatus, 2000);
    const logTimer = setInterval(refreshCommits, 5000);
    onCleanup(() => {
      clearInterval(timer);
      clearInterval(logTimer);
    });
  });

  return (
    <GitContext.Provider
      value={{
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
      }}
    >
      {props.children}
    </GitContext.Provider>
  );
}

export function useGit() {
  const context = useContext(GitContext);
  if (!context) {
    throw new Error("useGit must be used within a GitProvider");
  }
  return context;
}

type AppStateContextValue = {
  selectedFile: () => string | null;
  selectedFileKey: () => string | null;
  selectedFileSection: () => FileSection | null;
  diffContent: () => string | null;
  focusedRowIndex: () => number;
  visibleFiles: () => GitStatusFile[];
  focusedFile: () => GitStatusFile | null;
  diffViewMode: () => DiffViewMode;
  toggleDiffViewMode: () => void;
  selectFile: (filePath: string) => void;
  focusPreviousRow: () => void;
  focusNextRow: () => void;
  stageSelectedFile: () => void;
  unstageSelectedFile: () => void;
  discardSelectedFile: () => void;
};

const AppStateContext = createContext<AppStateContextValue>();

export function AppStateProvider(props: { children: any }) {
  const git = useGit();
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [selectedFileKey, setSelectedFileKey] = createSignal<string | null>(null);
  const [selectedFileSection, setSelectedFileSection] = createSignal<FileSection | null>(null);
  const [diffContent, setDiffContent] = createSignal<string | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = createSignal(0);
  const [diffViewMode, setDiffViewMode] = createSignal<DiffViewMode>("unified");

  const visibleFiles = createMemo(() => {
    const status = git.status();
    if (!status) return [];

    return [...status.files.staged, ...status.files.changes];
  });

  const focusedFile = createMemo(() => visibleFiles()[focusedRowIndex()] ?? null);

  const selectedFileInfo = createMemo(() => {
    const status = git.status();
    const filePath = selectedFile();
    const section = selectedFileSection();
    if (!status || !filePath) return null;

    if (section === "staged") {
      return status.files.staged.find((file) => file.path === filePath) ?? null;
    }

    if (section === "changes") {
      return status.files.changes.find((file) => file.path === filePath) ?? null;
    }

    return visibleFiles().find((file) => file.path === filePath) ?? null;
  });

  const loadFile = (filePath: string, section: FileSection | null) => {
    try {
      const status = git.status();
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
    setSelectedFileKey(`${section}:${filePath}`);
    setSelectedFileSection(section);
    loadFile(filePath, section);
  };

  const focusRow = (nextIndex: number) => {
    const files = visibleFiles();
    const file = files[nextIndex];
    const section: FileSection | null =
      nextIndex < (git.status()?.files.staged.length ?? 0) ? "staged" : "changes";
    setFocusedRowIndex(nextIndex);

    if (file) {
      selectFile(file.path, section ?? "changes");
    }
  };

  createEffect(() => {
    git.status();
    const files = visibleFiles();
    if (files.length > 0 && !selectedFile()) {
      const stagedFiles = git.status()?.files.staged ?? [];
      const changesFiles = git.status()?.files.changes ?? [];
      const first = stagedFiles[0] ?? changesFiles[0];
      const firstSection: FileSection = stagedFiles.length > 0 ? "staged" : "changes";
      if (first) {
        setSelectedFile(first.path);
        setSelectedFileKey(`${firstSection}:${first.path}`);
        setSelectedFileSection(firstSection);
        loadFile(first.path, firstSection);
      }
    } else if (files.length === 0) {
      setSelectedFile(null);
      setSelectedFileKey(null);
      setSelectedFileSection(null);
      setDiffContent(null);
    }
  });

  createEffect(() => {
    const files = visibleFiles();
    const index = focusedRowIndex();

    if (files.length === 0) {
      if (index !== 0) {
        setFocusedRowIndex(0);
      }
      return;
    }

    if (index >= files.length) {
      setFocusedRowIndex(Math.max(0, files.length - 1));
    }
  });

  createEffect(() => {
    const filePath = selectedFile();
    const files = visibleFiles();

    if (!filePath || files.length === 0) {
      return;
    }

    const nextIndex = files.findIndex((file) => file.path === filePath);
    if (nextIndex !== -1 && focusedRowIndex() !== nextIndex) {
      setFocusedRowIndex(nextIndex);
    }
  });

  return (
    <AppStateContext.Provider
      value={{
        selectedFile,
        selectedFileKey,
        selectedFileSection,
        diffContent,
        focusedRowIndex,
        visibleFiles,
        focusedFile,
        diffViewMode,
        toggleDiffViewMode: () =>
          setDiffViewMode((current) => (current === "unified" ? "split" : "unified")),
        selectFile,
        focusPreviousRow: () => focusRow(Math.max(0, focusedRowIndex() - 1)),
        focusNextRow: () =>
          focusRow(Math.min(visibleFiles().length - 1, focusedRowIndex() + 1)),
        stageSelectedFile: () => {
          const file = selectedFileInfo();
          if (file) git.stageFile(file.path);
        },
        unstageSelectedFile: () => {
          const file = selectedFileInfo();
          if (file) git.unstageFile(file.path);
        },
        discardSelectedFile: () => {
          const file = selectedFileInfo();
          if (file) git.discardChanges(file.path);
        },
      }}
    >
      {props.children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const context = useContext(AppStateContext);
  if (!context) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return context;
}
