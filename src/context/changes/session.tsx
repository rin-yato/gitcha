import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type { CompareState, CompareTarget, GitRepoStatus, GitStatusFile } from "../../git";
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
} from "../../git";

export type ReviewSession = {
  status: GitRepoStatus | null;
  error: string | null;
  commits: string[];
  branches: string[];
  compareState: CompareState | null;
  defaultCompareTarget: CompareTarget | null;
  client: GitClient;
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

export type GitClient = {
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

export function createGitClient(): GitClient {
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

export function visibleFiles(status: GitRepoStatus | null): GitStatusFile[] {
  if (!status) return [];
  return [...status.files.staged, ...status.files.changes, ...status.files.untracked];
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

const ReviewSessionContext = createContext<ReviewSession | null>(null);

export function ReviewProvider({
  children,
  client = createGitClient(),
}: {
  children: React.ReactNode;
  client?: GitClient;
}) {
  return <ReviewProviderBase children={children} client={client} />;
}

export function ReviewProviderBase({
  children,
  client,
}: {
  children: React.ReactNode;
  client: GitClient;
}) {
  const [status, setStatus] = useState<GitRepoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [compareState, setCompareState] = useState<CompareState | null>(null);
  const [defaultCompareTarget, setDefaultCompareTarget] = useState<CompareTarget | null>(null);

  const refreshStatus = useCallback(() => {
    try {
      const newStatus = client.getRepoStatus();
      setStatus(newStatus);
      setError(null);

      if (newStatus.isRepo) {
        setDefaultCompareTarget(client.getDefaultCompareTarget());
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git status");
      setStatus(null);
    }
  }, [client]);

  const refreshCommits = useCallback(() => {
    try {
      setCommits(client.getRecentCommits());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git log");
      setCommits([]);
    }
  }, [client]);

  const refreshBranches = useCallback(() => {
    try {
      setBranches(client.getLocalBranches());
    } catch {
      // ignore branch list errors
    }
  }, [client]);

  const refreshCompare = useCallback(() => {
    setCompareState((prev) => {
      if (!prev) return prev;
      try {
        const files = client.getBranchDiffFiles(prev.baseRef);
        return { ...prev, files };
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load branch diff");
        return prev;
      }
    });
  }, [client]);

  const startCompare = useCallback(
    (target: CompareTarget) => {
      try {
        const files = client.getBranchDiffFiles(target.ref);
        const nextState = { baseRef: target.ref, baseLabel: target.label, files };
        setCompareState(nextState);
        setError(null);
        return nextState;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start compare");
        return null;
      }
    },
    [client],
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

  const value = useMemo<ReviewSession>(
    () => ({
      status,
      error,
      commits,
      branches,
      compareState,
      defaultCompareTarget,
      client,
      refreshStatus,
      refreshCommits,
      stageFile: (filePath: string) => runGitAction(() => client.stageFile(filePath)),
      unstageFile: (filePath: string) => runGitAction(() => client.unstageFile(filePath)),
      discardChanges: (filePath: string) => runGitAction(() => client.discardChanges(filePath)),
      commitChanges: (message: string) => runGitAction(() => client.commitChanges(message)),
      pushChanges: () => runGitAction(() => client.pushChanges()),
      pullChanges: () => runGitAction(() => client.pullChanges()),
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
      client,
      refreshStatus,
      refreshCommits,
      runGitAction,
      startCompare,
      stopCompare,
      refreshCompare,
    ],
  );

  return (
    <ReviewSessionContext.Provider value={value}>{children}</ReviewSessionContext.Provider>
  );
}

export function useReviewSession() {
  const context = useContext(ReviewSessionContext);
  if (!context) {
    throw new Error("useReviewSession must be used within a ReviewProvider");
  }
  return context;
}
