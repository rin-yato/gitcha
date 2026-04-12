import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type {
  CompareState,
  CompareTarget,
  FileDiffSource,
  GitRepoStatus,
  GitStatusFile,
  RepoContext,
} from "@/lib/git";
import {
  commitChanges as commitGitChanges,
  detectRepoContext,
  discardChanges as discardGitChanges,
  getBranchDiffFiles,
  getCompareTarget,
  getFileVersion,
  getLocalBranches,
  getMergeBase,
  getRecentCommits,
  getRepoStatus,
  loadChangesDiffSource,
  loadCompareDiffSource,
  loadStagedDiffSource,
  pullChanges as pullGitChanges,
  pushChanges as pushGitChanges,
  stageFile as stageGitFile,
  unstageFile as unstageGitFile,
} from "@/lib/git";

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
  startCompare: (target: CompareTarget) => Promise<CompareState | null>;
  stopCompare: () => void;
  refreshCompare: () => void;
};

export type GitClient = {
  ctx: RepoContext;
  getRepoStatus: () => Promise<GitRepoStatus>;
  getRecentCommits: () => Promise<string[]>;
  getLocalBranches: () => Promise<string[]>;
  getCompareTarget: () => Promise<CompareTarget | null>;
  getBranchDiffFiles: (baseRef: string) => Promise<GitStatusFile[]>;
  getFileVersion: (ref: string, path: string) => Promise<string | null>;
  getMergeBase: (baseRef: string) => Promise<string>;
  loadDiffSource: (
    file: GitStatusFile,
    section: "staged" | "changes" | "compare",
    compareBaseRef?: string,
  ) => Promise<FileDiffSource>;
  stageFile: (filePath: string) => Promise<void>;
  unstageFile: (filePath: string) => Promise<void>;
  discardChanges: (filePath: string) => Promise<void>;
  commitChanges: (message: string) => Promise<void>;
  pushChanges: () => Promise<void>;
  pullChanges: () => Promise<void>;
};

export function createGitClient(ctx: RepoContext): GitClient {
  return {
    ctx,
    getRepoStatus: () => getRepoStatus(ctx.cwd),
    getRecentCommits: () => getRecentCommits(12, ctx.cwd),
    getLocalBranches: () => getLocalBranches(ctx.cwd),
    getCompareTarget: () => getCompareTarget(ctx.cwd),
    getBranchDiffFiles: (baseRef: string) => getBranchDiffFiles(baseRef, ctx.cwd),
    getFileVersion: (ref: string, path: string) => getFileVersion(ref, path, ctx.cwd),
    getMergeBase: (baseRef: string) => getMergeBase(baseRef, ctx.cwd),
    loadDiffSource: async (file, section, compareBaseRef) => {
      if (section === "compare" && compareBaseRef) {
        const baseRef = await getMergeBase(compareBaseRef, ctx.cwd);
        return loadCompareDiffSource(ctx, file, baseRef);
      }
      if (section === "staged") {
        return loadStagedDiffSource(ctx, file);
      }
      return loadChangesDiffSource(ctx, file);
    },
    stageFile: (filePath: string) => stageGitFile(filePath, ctx.cwd),
    unstageFile: (filePath: string) => unstageGitFile(filePath, ctx.cwd),
    discardChanges: (filePath: string) => discardGitChanges(filePath, ctx.cwd),
    commitChanges: (message: string) => commitGitChanges(message, ctx.cwd),
    pushChanges: () => pushGitChanges(ctx.cwd),
    pullChanges: () => pullGitChanges(ctx.cwd),
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
  repoCwd,
  client: providedClient,
}: {
  children: React.ReactNode;
  repoCwd?: string;
  client?: GitClient;
}) {
  const [_ctx, setCtx] = useState<RepoContext | null>(null);
  const [client, setClient] = useState<GitClient | null>(null);
  const [status, setStatus] = useState<GitRepoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [commits, setCommits] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [compareState, setCompareState] = useState<CompareState | null>(null);
  const [defaultCompareTarget, setDefaultCompareTarget] = useState<CompareTarget | null>(null);

  useEffect(() => {
    if (providedClient) {
      setClient(providedClient);
      setCtx(providedClient.ctx);
      return;
    }
    detectRepoContext(repoCwd).then((newCtx) => {
      if (newCtx) {
        setCtx(newCtx);
        setClient(createGitClient(newCtx));
      } else {
        setError("Not a git repository");
      }
    });
  }, [repoCwd, providedClient]);

  const refreshStatus = useCallback(() => {
    if (!client) return;
    client
      .getRepoStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [client]);

  const refreshCommits = useCallback(() => {
    if (!client) return;
    client
      .getRecentCommits()
      .then(setCommits)
      .catch(() => setCommits([]));
  }, [client]);

  const refreshBranches = useCallback(() => {
    if (!client) return;
    client
      .getLocalBranches()
      .then(setBranches)
      .catch(() => {});
  }, [client]);

  const refreshCompare = useCallback(() => {
    if (!client || !compareState) return;
    client
      .getBranchDiffFiles(compareState.baseRef)
      .then((files) => {
        setCompareState((s) => (s ? { ...s, files } : s));
      })
      .catch(() => {});
  }, [client, compareState]);

  const startCompare = useCallback(
    async (target: CompareTarget): Promise<CompareState | null> => {
      if (!client) return null;
      try {
        const files = await client.getBranchDiffFiles(target.ref);
        const nextState = { baseRef: target.ref, baseLabel: target.label, files };
        setCompareState(nextState);
        return nextState;
      } catch {
        return null;
      }
    },
    [client],
  );

  const stopCompare = useCallback(() => setCompareState(null), []);

  const runGitAction = useCallback(
    (action: () => Promise<void>) => {
      if (!client) return;
      action()
        .then(refreshStatus)
        .catch(() => {});
    },
    [client, refreshStatus],
  );

  useEffect(() => {
    if (!client) return;
    refreshStatus();
    refreshCommits();
    refreshBranches();
    client
      .getCompareTarget()
      .then(setDefaultCompareTarget)
      .catch(() => {});

    const statusTimer = setInterval(refreshStatus, 5000);
    const commitsTimer = setInterval(refreshCommits, 10000);
    const branchesTimer = setInterval(refreshBranches, 15000);

    return () => {
      clearInterval(statusTimer);
      clearInterval(commitsTimer);
      clearInterval(branchesTimer);
    };
  }, [client, refreshStatus, refreshCommits, refreshBranches]);

  const value = useMemo<ReviewSession | null>(
    () =>
      client
        ? {
            status,
            error,
            commits,
            branches,
            compareState,
            defaultCompareTarget,
            client,
            refreshStatus,
            refreshCommits,
            stageFile: (filePath) => runGitAction(() => client.stageFile(filePath)),
            unstageFile: (filePath) => runGitAction(() => client.unstageFile(filePath)),
            discardChanges: (filePath) => runGitAction(() => client.discardChanges(filePath)),
            commitChanges: (message) => runGitAction(() => client.commitChanges(message)),
            pushChanges: () => runGitAction(() => client.pushChanges()),
            pullChanges: () => runGitAction(() => client.pullChanges()),
            startCompare,
            stopCompare,
            refreshCompare,
          }
        : null,
    [
      client,
      status,
      error,
      commits,
      branches,
      compareState,
      defaultCompareTarget,
      refreshStatus,
      refreshCommits,
      runGitAction,
      startCompare,
      stopCompare,
      refreshCompare,
    ],
  );

  if (!value) {
    return (
      <box>
        <text content={error ?? "Loading..."} />
      </box>
    );
  }

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
