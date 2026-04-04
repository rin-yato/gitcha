import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { GitRepoStatus, GitStatusFile } from "../git";
import {
  commitChanges as commitGitChanges,
  discardChanges as discardGitChanges,
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
  refreshStatus: () => void;
  refreshCommits: () => void;
  stageFile: (filePath: string) => void;
  unstageFile: (filePath: string) => void;
  discardChanges: (filePath: string) => void;
  commitChanges: (message: string) => void;
  pushChanges: () => void;
  pullChanges: () => void;
};

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

export function GitProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<GitRepoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState<string[]>([]);

  const refreshStatus = useCallback(() => {
    try {
      setStatus(getRepoStatus());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git status");
      setStatus(null);
    }
  }, []);

  const refreshCommits = useCallback(() => {
    try {
      setCommits(getRecentCommits());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git log");
      setCommits([]);
    }
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

  useEffect(() => {
    refreshStatus();
    refreshCommits();

    const statusTimer = setInterval(refreshStatus, 2000);
    const commitsTimer = setInterval(refreshCommits, 5000);

    return () => {
      clearInterval(statusTimer);
      clearInterval(commitsTimer);
    };
  }, [refreshStatus, refreshCommits]);

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
    [commits, error, status, refreshStatus, refreshCommits, runGitAction],
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
