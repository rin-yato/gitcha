import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import type {
  CompareMode,
  CompareState,
  CompareTarget,
  FileDiffSource,
  FileTreeSnapshot,
  GitRepoStatus,
  GitStatusFile,
  RepoContext,
} from "@/lib/git";
import {
  BINARY_UNSUPPORTED_REASON,
  buildFileTreeSnapshot,
  commitChanges as commitGitChanges,
  detectRepoContext,
  discardChanges as discardGitChanges,
  getBranchDiffFiles,
  getCommitDiffFiles,
  getCommitParent,
  getCompareBranches,
  getCompareTarget,
  getFileVersion,
  getLocalBranches,
  getMergeBase,
  getRecentCommitSummaries,
  getRepoStatus,
  getUnsupportedReason,
  isBinaryDiff,
  loadChangesDiffSource,
  loadCompareDiffSource,
  loadStagedDiffSource,
  pullChanges as pullGitChanges,
  pushChanges as pushGitChanges,
  SAMPLE_BYTE_LIMIT,
  searchCompareBranches,
  searchCompareCommits,
  stageFile as stageGitFile,
  unstageFile as unstageGitFile,
} from "@/lib/git";

export type ReviewSession = {
  status: GitRepoStatus | null;
  error: string | null;
  compareState: CompareState | null;
  fileTrees: {
    staged: FileTreeSnapshot;
    changes: FileTreeSnapshot;
    compare: FileTreeSnapshot;
  };
  client: GitClient;
  refreshStatus: () => void;
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

export type ReviewBootstrap = {
  client: GitClient | null;
  status: GitRepoStatus | null;
  error: string | null;
};

export type GitClient = {
  ctx: RepoContext;
  getRepoStatus: (options?: { includeUntracked?: boolean }) => Promise<GitRepoStatus>;
  getLocalBranches: () => Promise<string[]>;
  getCompareBranches: () => Promise<string[]>;
  getCompareTarget: () => Promise<CompareTarget | null>;
  getBranchDiffFiles: (baseRef: string) => Promise<GitStatusFile[]>;
  getCommitDiffFiles: (commitRef: string) => Promise<GitStatusFile[]>;
  getCommitParent: (commitRef: string) => Promise<string | null>;
  getRecentCommitSummaries: (
    limit?: number,
  ) => Promise<Array<{ ref: string; shortRef: string; message: string; origin: string }>>;
  searchCompareBranches: (query: string) => Promise<string[]>;
  searchCompareCommits: (
    query: string,
  ) => Promise<Array<{ ref: string; shortRef: string; message: string; origin: string }>>;
  getFileVersion: (ref: string, path: string) => Promise<string | null>;
  getMergeBase: (baseRef: string) => Promise<string>;
  getDiffUnsupportedReason: (
    file: GitStatusFile,
    section: "staged" | "changes" | "compare",
    compareBaseRef?: string,
    compareTargetRef?: string | null,
    compareMode?: CompareMode,
  ) => Promise<string | null>;
  loadDiffSource: (
    file: GitStatusFile,
    section: "staged" | "changes" | "compare",
    compareBaseRef?: string,
    compareTargetRef?: string | null,
    compareMode?: CompareMode,
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
    getRepoStatus: (options) => getRepoStatus(ctx.cwd, options),
    getLocalBranches: () => getLocalBranches(ctx.cwd),
    getCompareBranches: () => getCompareBranches(ctx.cwd),
    getCompareTarget: () => getCompareTarget(ctx.cwd),
    getBranchDiffFiles: (baseRef: string) => getBranchDiffFiles(baseRef, ctx.cwd),
    getCommitDiffFiles: (commitRef: string) => getCommitDiffFiles(commitRef, ctx.cwd),
    getCommitParent: (commitRef: string) => getCommitParent(commitRef, ctx.cwd),
    getRecentCommitSummaries: (limit = 12) => getRecentCommitSummaries(limit, ctx.cwd),
    searchCompareBranches: (query: string) => searchCompareBranches(query, ctx.cwd),
    searchCompareCommits: (query: string) => searchCompareCommits(query, 1000, ctx.cwd),
    getFileVersion: (ref: string, path: string) => getFileVersion(ref, path, ctx.cwd),
    getMergeBase: (baseRef: string) => getMergeBase(baseRef, ctx.cwd),
    getDiffUnsupportedReason: async (
      file,
      section,
      compareBaseRef,
      compareTargetRef,
      compareMode,
    ) => {
      const unsupportedReason = getUnsupportedReason(file.path, null);
      if (unsupportedReason) return unsupportedReason;

      if (file.indexStatus === "?" || file.workingTreeStatus === "?") {
        const sample = await ctx.backend.readFileSample(
          ctx.toRootPath(file.path),
          SAMPLE_BYTE_LIMIT,
        );
        return getUnsupportedReason(file.path, sample);
      }

      if (section === "staged") {
        return (await isBinaryDiff(file.path, section, undefined, undefined, ctx.cwd))
          ? BINARY_UNSUPPORTED_REASON
          : null;
      }

      if (section === "changes") {
        return (await isBinaryDiff(file.path, section, undefined, undefined, ctx.cwd))
          ? BINARY_UNSUPPORTED_REASON
          : null;
      }

      if (section === "compare" && compareBaseRef) {
        if (compareMode === "base-branch") {
          const baseRef = await getMergeBase(compareBaseRef, ctx.cwd);
          return (await isBinaryDiff(
            file.path,
            section,
            baseRef,
            compareTargetRef ?? undefined,
            ctx.cwd,
          ))
            ? BINARY_UNSUPPORTED_REASON
            : null;
        }

        return (await isBinaryDiff(
          file.path,
          section,
          compareBaseRef,
          compareTargetRef ?? undefined,
          ctx.cwd,
        ))
          ? BINARY_UNSUPPORTED_REASON
          : null;
      }

      return null;
    },
    loadDiffSource: async (file, section, compareBaseRef, compareTargetRef, compareMode) => {
      if (section === "compare" && compareBaseRef) {
        if (compareMode === "base-branch") {
          const baseRef = await getMergeBase(compareBaseRef, ctx.cwd);
          return loadCompareDiffSource(ctx, file, baseRef, compareTargetRef);
        }

        return loadCompareDiffSource(ctx, file, compareBaseRef, compareTargetRef);
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

export async function bootstrapReviewSession(repoCwd?: string): Promise<ReviewBootstrap> {
  const ctx = await detectRepoContext(repoCwd);
  if (!ctx) {
    return {
      client: null,
      status: null,
      error: "Not a git repository",
    };
  }

  const client = createGitClient(ctx);
  const status = await client.getRepoStatus({ includeUntracked: false }).catch(() => null);

  return {
    client,
    status,
    error: status ? null : "Failed to load git status",
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
  bootstrap,
}: {
  children: React.ReactNode;
  repoCwd?: string;
  bootstrap?: Promise<ReviewBootstrap>;
}) {
  const [client, setClient] = useState<GitClient | null>(null);
  const [status, setStatus] = useState<GitRepoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compareState, setCompareState] = useState<CompareState | null>(null);

  const fileTrees = useMemo(
    () => ({
      staged: buildFileTreeSnapshot(status?.files.staged ?? []),
      changes: buildFileTreeSnapshot([
        ...(status?.files.changes ?? []),
        ...(status?.files.untracked ?? []),
      ]),
      compare: buildFileTreeSnapshot(compareState?.files ?? []),
    }),
    [compareState, status],
  );

  useEffect(() => {
    if (bootstrap) {
      let cancelled = false;

      void bootstrap.then((nextBootstrap) => {
        if (cancelled) return;
        setClient(nextBootstrap.client);
        setStatus(nextBootstrap.status);
        setError(nextBootstrap.error);
      });

      return () => {
        cancelled = true;
      };
    }

    void bootstrapReviewSession(repoCwd).then((nextBootstrap) => {
      setClient(nextBootstrap.client);
      setStatus(nextBootstrap.status);
      setError(nextBootstrap.error);
    });
  }, [bootstrap, repoCwd]);

  const refreshStatus = useCallback(() => {
    if (!client) return;
    client
      .getRepoStatus()
      .then(setStatus)
      .catch(() => setStatus(null));
  }, [client]);

  const refreshCompare = useCallback(() => {
    if (!client || !compareState) return;
    const loader =
      compareState.mode === "single-commit" && compareState.targetRef
        ? client.getCommitDiffFiles(compareState.targetRef)
        : client.getBranchDiffFiles(compareState.baseRef);

    loader
      .then((files) => {
        setCompareState((s) => (s ? { ...s, files } : s));
      })
      .catch(() => {});
  }, [client, compareState]);

  const startCompare = useCallback(
    async (target: CompareTarget): Promise<CompareState | null> => {
      if (!client) return null;
      try {
        if (target.mode === "single-commit") {
          const parentRef = (await client.getCommitParent(target.ref)) ?? target.ref;
          const files = await client.getCommitDiffFiles(target.ref);
          const nextState = {
            mode: target.mode,
            baseRef: parentRef,
            targetRef: target.ref,
            baseLabel: target.label,
            files,
          };
          setCompareState(nextState);
          return nextState;
        }

        const files =
          target.mode === "base-commit"
            ? await client.getCommitDiffFiles(target.ref)
            : await client.getBranchDiffFiles(target.ref);
        const nextState = {
          mode: target.mode,
          baseRef: target.ref,
          targetRef: null,
          baseLabel: target.label,
          files,
        };
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

    const statusTimer = setInterval(() => {
      void refreshStatus();
    }, 5000);

    return () => {
      clearInterval(statusTimer);
    };
  }, [client, refreshStatus]);

  const value = useMemo<ReviewSession | null>(
    () =>
      client
        ? {
            status,
            error,
            compareState,
            fileTrees,
            client,
            refreshStatus,
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
      compareState,
      fileTrees,
      refreshStatus,
      runGitAction,
      startCompare,
      stopCompare,
      refreshCompare,
    ],
  );

  if (!value) {
    return (
      <box width="100%" height="100%" justifyContent="center" alignItems="center">
        <text content={error ?? "Loading..."} selectable={false} />
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
