import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { CompareState, CompareTarget, GitRepoStatus, GitStatusFile } from "../git";
import {
  commitChanges as commitGitChanges,
  discardChanges as discardGitChanges,
  getBranchDiffFiles,
  getDefaultCompareTarget,
  getFileDiff,
  getFileDiffWithContext,
  getLocalBranches,
  getRecentCommits,
  getRepoStatus,
  pullChanges as pullGitChanges,
  pushChanges as pushGitChanges,
  stageFile as stageGitFile,
  unstageFile as unstageGitFile,
} from "../git";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GitContextValue = {
  status: GitRepoStatus | null;
  error: string | null;
  commits: string[];
  branches: string[];
  compareState: CompareState | null;
  defaultCompareTarget: CompareTarget | null;
  backend: GitBackend;
  refreshStatus: () => void;
  refreshCommits: () => void;
  stageFile: (filePath: string) => void;
  unstageFile: (filePath: string) => void;
  discardChanges: (filePath: string) => void;
  commitChanges: (message: string) => void;
  pushChanges: () => void;
  pullChanges: () => void;
  startCompare: (target: CompareTarget) => CompareState | null;
  stopCompare: () => void;
  refreshCompare: () => void;
};

export type GitBackend = {
  getRepoStatus: typeof getRepoStatus;
  getRecentCommits: typeof getRecentCommits;
  getLocalBranches: typeof getLocalBranches;
  getDefaultCompareTarget: typeof getDefaultCompareTarget;
  getBranchDiffFiles: typeof getBranchDiffFiles;
  getFileDiffWithContext: typeof getFileDiffWithContext;
  getFileDiff: typeof getFileDiff;
  stageFile: typeof stageGitFile;
  unstageFile: typeof unstageGitFile;
  discardChanges: typeof discardGitChanges;
  commitChanges: typeof commitGitChanges;
  pushChanges: typeof pushGitChanges;
  pullChanges: typeof pullGitChanges;
};

export function createDefaultGitBackend(): GitBackend {
  return {
    getRepoStatus,
    getRecentCommits,
    getLocalBranches,
    getDefaultCompareTarget,
    getBranchDiffFiles,
    getFileDiffWithContext,
    getFileDiff,
    stageFile: stageGitFile,
    unstageFile: unstageGitFile,
    discardChanges: discardGitChanges,
    commitChanges: commitGitChanges,
    pushChanges: pushGitChanges,
    pullChanges: pullGitChanges,
  };
}

// ---------------------------------------------------------------------------
// Pure helpers (git scope)
// ---------------------------------------------------------------------------

export function visibleFiles(status: GitRepoStatus | null): GitStatusFile[] {
  if (!status) return [];
  return [...status.files.staged, ...status.files.changes];
}

export function stagedFileCount(status: GitRepoStatus | null): number {
  return status?.files.staged.length ?? 0;
}

export function sectionForIndex(index: number, stagedCount: number): "staged" | "changes" {
  return index < stagedCount ? "staged" : "changes";
}

export function firstAvailableFile(
  status: GitRepoStatus | null,
): { path: string; section: "staged" | "changes" } | null {
  if (!status) return null;

  const staged = status.files.staged[0];
  if (staged) return { path: staged.path, section: "staged" };

  const changed = status.files.changes[0];
  if (changed) return { path: changed.path, section: "changes" };

  return null;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const GitContext = createContext<GitContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function GitProvider({
  children,
  backend = createDefaultGitBackend(),
}: {
  children: React.ReactNode;
  backend?: GitBackend;
}) {
  return <GitProviderBase children={children} backend={backend} />;
}

export function GitProviderBase({
  children,
  backend,
}: {
  children: React.ReactNode;
  backend: GitBackend;
}) {
  const [status, setStatus] = useState<GitRepoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [compareState, setCompareState] = useState<CompareState | null>(null);
  const [defaultCompareTarget, setDefaultCompareTarget] = useState<CompareTarget | null>(null);

  const refreshStatus = useCallback(() => {
    try {
      const newStatus = backend.getRepoStatus();
      setStatus(newStatus);
      setError(null);

      if (newStatus.isRepo) {
        setDefaultCompareTarget(backend.getDefaultCompareTarget());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git status");
      setStatus(null);
    }
  }, [backend]);

  const refreshCommits = useCallback(() => {
    try {
      setCommits(backend.getRecentCommits());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git log");
      setCommits([]);
    }
  }, [backend]);

  const refreshBranches = useCallback(() => {
    try {
      setBranches(backend.getLocalBranches());
    } catch {
      // ignore branch list errors
    }
  }, [backend]);

  const refreshCompare = useCallback(() => {
    setCompareState((prev) => {
      if (!prev) return prev;
      try {
        const files = backend.getBranchDiffFiles(prev.baseRef);
        return { ...prev, files };
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load branch diff");
        return prev;
      }
    });
  }, [backend]);

  const startCompare = useCallback(
    (target: CompareTarget) => {
      try {
        const files = backend.getBranchDiffFiles(target.ref);
        const nextState = { baseRef: target.ref, baseLabel: target.label, files };
        setCompareState(nextState);
        setError(null);
        return nextState;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start compare");
        return null;
      }
    },
    [backend],
  );

  const stopCompare = useCallback(() => {
    setCompareState(null);
  }, []);

  const runGitAction = useCallback(
    (action: () => void) => {
      try {
        action();
        refreshStatus();
        refreshCommits();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Git action failed");
      }
    },
    [refreshStatus, refreshCommits],
  );

  // Initial fetch + polling
  useEffect(() => {
    refreshStatus();
    refreshCommits();
    refreshBranches();

    const statusTimer = setInterval(refreshStatus, 2000);
    const commitsTimer = setInterval(refreshCommits, 5000);
    const branchesTimer = setInterval(refreshBranches, 10000);

    return () => {
      clearInterval(statusTimer);
      clearInterval(commitsTimer);
      clearInterval(branchesTimer);
    };
  }, [refreshStatus, refreshCommits, refreshBranches]);

  const value = useMemo<GitContextValue>(
    () => ({
      status,
      error,
      commits,
      branches,
      compareState,
      defaultCompareTarget,
      backend,
      refreshStatus,
      refreshCommits,
      stageFile: (filePath) => runGitAction(() => backend.stageFile(filePath)),
      unstageFile: (filePath) => runGitAction(() => backend.unstageFile(filePath)),
      discardChanges: (filePath) => runGitAction(() => backend.discardChanges(filePath)),
      commitChanges: (message) => runGitAction(() => backend.commitChanges(message)),
      pushChanges: () => runGitAction(() => backend.pushChanges()),
      pullChanges: () => runGitAction(() => backend.pullChanges()),
      startCompare,
      stopCompare,
      refreshCompare,
    }),
    [
      status,
      error,
      commits,
      branches,
      compareState,
      defaultCompareTarget,
      backend,
      refreshStatus,
      refreshCommits,
      runGitAction,
      startCompare,
      stopCompare,
      refreshCompare,
    ],
  );

  return <GitContext.Provider value={value}>{children}</GitContext.Provider>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGit() {
  const context = useContext(GitContext);
  if (!context) {
    throw new Error("useGit must be used within a GitProvider");
  }
  return context;
}
