import {
  createContext,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  onMount,
  useContext,
} from "solid-js";

import type { FileTreeNode, GitRepoStatus, GitStatusFile } from "./git";
import {
  buildFileTree,
  commitChanges as commitGitChanges,
  discardChanges as discardGitChanges,
  getFileDiff,
  getRecentCommits,
  getRepoStatus,
  pullChanges as pullGitChanges,
  pushChanges as pushGitChanges,
  stageFile as stageGitFile,
  unstageFile as unstageGitFile,
} from "./git";

export type DiffViewMode = "unified" | "split";
export type TreeSection = "staged" | "changes" | "untracked";

export type VisibleTreeRow = {
  id: string;
  path: string;
  depth: number;
  isDirectory: boolean;
  section: TreeSection;
  node: FileTreeNode;
};

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
  diffContent: () => string | null;
  focusedRowIndex: () => number;
  allFiles: () => GitStatusFile[];
  expandedPaths: () => string[];
  visibleRows: () => VisibleTreeRow[];
  focusedRow: () => VisibleTreeRow | null;
  isExpanded: (path: string) => boolean;
  toggleDirectory: (path: string) => void;
  expandDirectory: (path: string) => void;
  collapseDirectory: (path: string) => void;
  diffViewMode: () => DiffViewMode;
  toggleDiffViewMode: () => void;
  selectFile: (filePath: string) => void;
  focusPreviousRow: () => void;
  focusNextRow: () => void;
  activateFocusedRow: () => void;
  stageSelectedFile: () => void;
  unstageSelectedFile: () => void;
  discardSelectedFile: () => void;
};

const AppStateContext = createContext<AppStateContextValue>();

export function AppStateProvider(props: { children: any }) {
  const git = useGit();
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [diffContent, setDiffContent] = createSignal<string | null>(null);
  const [focusedRowIndex, setFocusedRowIndex] = createSignal(0);
  const [expandedPaths, setExpandedPaths] = createSignal<string[]>([]);
  const [diffViewMode, setDiffViewMode] = createSignal<DiffViewMode>("unified");

  const allFiles = createMemo(() => {
    const status = git.status();
    if (!status) return [];

    return [...status.files.staged, ...status.files.changes, ...status.files.untracked];
  });

  const selectedFileInfo = createMemo(() => {
    const status = git.status();
    const filePath = selectedFile();
    if (!status || !filePath) return null;

    return allFiles().find((file) => file.path === filePath) ?? null;
  });

  const visibleRows = createMemo<VisibleTreeRow[]>(() => {
    const status = git.status();
    if (!status) return [];

    const rows: VisibleTreeRow[] = [];
    const sections: Array<{ key: TreeSection; files: GitStatusFile[] }> = [
      { key: "staged", files: status.files.staged },
      { key: "changes", files: status.files.changes },
      { key: "untracked", files: status.files.untracked },
    ];

    const walk = (node: FileTreeNode, section: TreeSection, depth: number) => {
      rows.push({
        id: `${section}:${node.path}`,
        path: node.path,
        depth,
        isDirectory: node.isDirectory,
        section,
        node,
      });

      if (!node.isDirectory || !expandedPaths().includes(node.path)) {
        return;
      }

      for (const child of node.children) {
        walk(child, section, depth + 1);
      }
    };

    for (const section of sections) {
      const tree = buildFileTree(section.files);
      for (const child of tree.children) {
        walk(child, section.key, 0);
      }
    }

    return rows;
  });

  const focusedRow = createMemo(() => visibleRows()[focusedRowIndex()] ?? null);

  const loadDiff = (filePath: string) => {
    try {
      const status = git.status();
      if (!status) {
        setDiffContent(null);
        return;
      }

      const isStaged = status.files.staged.some((file) => file.path === filePath);
      const diff = getFileDiff(filePath, { staged: isStaged });
      setDiffContent(diff || "No changes to display");
    } catch (e) {
      setDiffContent(`Error loading diff: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  };

  const expandAncestors = (filePath: string) => {
    const parts = filePath.split("/");
    if (parts.length <= 1) return;

    const ancestors = parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join("/"));
    setExpandedPaths((current) => Array.from(new Set([...current, ...ancestors])));
  };

  const syncSelection = () => {
    const filePath = selectedFile();
    const files = allFiles();

    if (!filePath) {
      setDiffContent(null);
      return;
    }

    if (!files.some((file) => file.path === filePath)) {
      if (files.length > 0) {
        const nextFile = files[0];
        if (nextFile) {
          setSelectedFile(nextFile.path);
          expandAncestors(nextFile.path);
          loadDiff(nextFile.path);
          return;
        }
      }

      setSelectedFile(null);
      setDiffContent(null);
      return;
    }

    loadDiff(filePath);
  };

  const selectFile = (filePath: string) => {
    setSelectedFile(filePath);
    loadDiff(filePath);
    expandAncestors(filePath);
  };

  const focusRow = (nextIndex: number) => {
    const rows = visibleRows();
    const row = rows[nextIndex];
    setFocusedRowIndex(nextIndex);

    if (row && !row.isDirectory) {
      selectFile(row.path);
    }
  };

  createEffect(() => {
    git.status();
    syncSelection();
  });

  createEffect(() => {
    const files = allFiles();
    if (files.length > 0 && !selectedFile()) {
      const first = files[0];
      if (first) {
        setSelectedFile(first.path);
        expandAncestors(first.path);
        loadDiff(first.path);
      }
    }
  });

  createEffect(() => {
    const rows = visibleRows();
    const index = focusedRowIndex();

    if (rows.length === 0) {
      if (index !== 0) {
        setFocusedRowIndex(0);
      }
      return;
    }

    if (index >= rows.length) {
      setFocusedRowIndex(rows.length - 1);
    }
  });

  createEffect(() => {
    const filePath = selectedFile();
    const rows = visibleRows();

    if (!filePath || rows.length === 0) {
      return;
    }

    const nextIndex = rows.findIndex((row) => row.path === filePath && !row.isDirectory);
    if (nextIndex !== -1 && focusedRowIndex() !== nextIndex) {
      setFocusedRowIndex(nextIndex);
    }
  });

  return (
    <AppStateContext.Provider
      value={{
        selectedFile,
        diffContent,
        focusedRowIndex,
        allFiles,
        expandedPaths,
        visibleRows,
        focusedRow,
        isExpanded: (path) => expandedPaths().includes(path),
        toggleDirectory: (path) => {
          setExpandedPaths((current) =>
            current.includes(path)
              ? current.filter((item) => item !== path)
              : [...current, path],
          );
        },
        expandDirectory: (path) => {
          setExpandedPaths((current) =>
            current.includes(path) ? current : [...current, path],
          );
        },
        collapseDirectory: (path) => {
          setExpandedPaths((current) => current.filter((item) => item !== path));
        },
        diffViewMode,
        toggleDiffViewMode: () =>
          setDiffViewMode((current) => (current === "unified" ? "split" : "unified")),
        selectFile,
        focusPreviousRow: () => focusRow(Math.max(0, focusedRowIndex() - 1)),
        focusNextRow: () => focusRow(Math.min(visibleRows().length - 1, focusedRowIndex() + 1)),
        activateFocusedRow: () => {
          const row = focusedRow();
          if (!row) return;

          if (row.isDirectory) {
            setExpandedPaths((current) =>
              current.includes(row.path)
                ? current.filter((item) => item !== row.path)
                : [...current, row.path],
            );
            return;
          }

          selectFile(row.path);
        },
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
