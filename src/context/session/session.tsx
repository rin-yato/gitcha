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

import type {
  CompareMode,
  CompareResolution,
  CompareState,
  CompareTarget,
  FileTreeSnapshot,
  GitRepoStatus,
  GitStatusFile,
  RepoContext,
} from "@/lib/git";
import {
  commitChanges as commitGitChanges,
  createRepoMonitor,
  detectRepoContext,
  discardChanges as discardGitChanges,
  getBranchDiffFiles,
  getCommitDiffFiles,
  getCommitParent,
  getCompareBranches,
  getCompareTarget,
  getLocalBranches,
  getMergeBase,
  getRecentCommitSummaries,
  getRevisionDiffFiles,
  getUnsupportedReason,
  gitStatusParser,
  isBinaryDiff,
  loadFileDiffSource,
  pullChanges as pullGitChanges,
  pushChanges as pushGitChanges,
  resolveCompareTarget,
  SAMPLE_BYTE_LIMIT,
  searchCompareBranches,
  searchCompareCommits,
  stageFile as stageGitFile,
  unstageFile as unstageGitFile,
} from "@/lib/git";

import { dequal } from "dequal";

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
  getDiffPatch: (
    file: GitStatusFile,
    section: "staged" | "changes" | "compare",
    compareBaseRef?: string,
    compareTargetRef?: string | null,
    compareMode?: CompareMode,
  ) => Promise<string | null>;
  getDiffUnsupportedReason: (
    file: GitStatusFile,
    section: "staged" | "changes" | "compare",
    compareBaseRef?: string,
    compareTargetRef?: string | null,
    compareMode?: CompareMode,
  ) => Promise<string | null>;
  getMergeBase: (baseRef: string) => Promise<string>;
  stageFile: (filePath: string) => Promise<void>;
  unstageFile: (filePath: string) => Promise<void>;
  discardChanges: (filePath: string) => Promise<void>;
  commitChanges: (message: string) => Promise<void>;
  pushChanges: () => Promise<void>;
  pullChanges: () => Promise<void>;
};

type DiffCacheKey = string;

type DiffRecord = {
  patch?: string | null;
  unsupportedReason?: string | null;
};

function fileTreeSignature(files: GitStatusFile[]): string {
  return files
    .map(
      (file) =>
        `${file.indexStatus}${file.workingTreeStatus}:${file.path}:${file.originalPath ?? ""}`,
    )
    .join("|");
}

function compareStateFromResolution(
  target: CompareTarget,
  resolution: CompareResolution,
  files: GitStatusFile[],
): CompareState {
  return {
    mode: target.mode,
    baseRef: resolution.baseRef,
    compareRef: resolution.compareRef,
    targetRef: resolution.targetRef,
    baseLabel: resolution.baseLabel,
    files,
  };
}

function buildDiffCacheKey(args: {
  file: GitStatusFile;
  section: "staged" | "changes" | "compare";
  compareBaseRef?: string;
  compareTargetRef?: string | null;
  compareMode?: CompareMode;
}): DiffCacheKey {
  const { file, section, compareBaseRef, compareTargetRef, compareMode } = args;
  return [
    section,
    compareMode ?? "",
    compareBaseRef ?? "",
    compareTargetRef ?? "",
    file.path,
    file.originalPath ?? "",
    file.indexStatus,
    file.workingTreeStatus,
  ].join("::");
}

function createGitClient(ctx: RepoContext): GitClient {
  const diffCache = new Map<DiffCacheKey, DiffRecord>();

  const getDiffUnsupportedReason = async (
    file: GitStatusFile,
    section: "staged" | "changes" | "compare",
    compareBaseRef?: string,
    compareTargetRef?: string | null,
    compareMode?: CompareMode,
  ) => {
    const cacheKey = buildDiffCacheKey({
      file,
      section,
      compareBaseRef,
      compareTargetRef,
      compareMode,
    });

    const cached = diffCache.get(cacheKey);
    if (cached) return cached.unsupportedReason ?? null;

    const unsupportedReason = getUnsupportedReason(file.path, null);
    if (unsupportedReason) {
      diffCache.set(cacheKey, { unsupportedReason });
      return unsupportedReason;
    }

    if (file.indexStatus === "?" || file.workingTreeStatus === "?") {
      const sample = await ctx.backend.readFileSample(
        ctx.toRootPath(file.path),
        SAMPLE_BYTE_LIMIT,
      );
      const reason = getUnsupportedReason(file.path, sample);
      diffCache.set(cacheKey, { unsupportedReason: reason });
      return reason;
    }

    const reason =
      section === "compare" && compareBaseRef
        ? (await isBinaryDiff(
            file.path,
            section,
            compareBaseRef,
            compareTargetRef ?? undefined,
            ctx.cwd,
          ))
          ? "Binary file - cannot display diff"
          : null
        : (await isBinaryDiff(file.path, section, undefined, undefined, ctx.cwd))
          ? "Binary file - cannot display diff"
          : null;

    diffCache.set(cacheKey, { unsupportedReason: reason });
    return reason;
  };

  return {
    ctx,
    getRepoStatus: (options) => gitStatusParser.getRepoStatus(ctx.cwd, options),
    getLocalBranches: () => getLocalBranches(ctx.cwd),
    getCompareBranches: () => getCompareBranches(ctx.cwd),
    getCompareTarget: () => getCompareTarget(ctx.cwd),
    getBranchDiffFiles: (baseRef: string) => getBranchDiffFiles(baseRef, ctx.cwd),
    getCommitDiffFiles: (commitRef: string) => getCommitDiffFiles(commitRef, ctx.cwd),
    getCommitParent: (commitRef: string) => getCommitParent(commitRef, ctx.cwd),
    getRecentCommitSummaries: (limit = 12) => getRecentCommitSummaries(limit, ctx.cwd),
    searchCompareBranches: (query: string) => searchCompareBranches(query, ctx.cwd),
    searchCompareCommits: (query: string) => searchCompareCommits(query, 1000, ctx.cwd),
    getMergeBase: (baseRef: string) => getMergeBase(baseRef, ctx.cwd),
    getDiffUnsupportedReason,
    getDiffPatch: async (file, section, compareBaseRef, compareTargetRef, compareMode) => {
      const cacheKey = buildDiffCacheKey({
        file,
        section,
        compareBaseRef,
        compareTargetRef,
        compareMode,
      });

      const cached = diffCache.get(cacheKey);
      if (cached?.patch !== undefined) return cached.patch;

      const reason = await getDiffUnsupportedReason(
        file,
        section,
        compareBaseRef,
        compareTargetRef,
        compareMode,
      );
      if (reason) return null;

      const source = await loadFileDiffSource({
        ctx,
        file,
        section,
        compareBaseRef,
        compareTargetRef,
        compareMode,
      });

      const patch = source.patch || null;
      diffCache.set(cacheKey, { patch, unsupportedReason: null });
      return patch;
    },
    stageFile: (filePath: string) => stageGitFile(filePath, ctx.cwd),
    unstageFile: (filePath: string) => unstageGitFile(filePath, ctx.cwd),
    discardChanges: (filePath: string) => discardGitChanges(filePath, ctx.cwd),
    commitChanges: (message: string) => commitGitChanges(message, ctx.cwd),
    pushChanges: () => pushGitChanges(ctx.cwd),
    pullChanges: () => pullGitChanges(ctx.cwd),
  };
}

async function resolveCompareFiles(
  client: GitClient,
  target: CompareTarget,
): Promise<{ resolution: CompareResolution; files: GitStatusFile[] }> {
  const resolution = await resolveCompareTarget(target, client.ctx.cwd);

  const files =
    target.mode === "single-commit"
      ? await client.getCommitDiffFiles(target.ref)
      : target.mode === "base-commit"
        ? await getRevisionDiffFiles(resolution.baseRef, resolution.compareRef, client.ctx.cwd)
        : await getBranchDiffFiles(target.ref, client.ctx.cwd);

  return { resolution, files };
}

export async function bootstrapReviewSession(repoCwd?: string): Promise<ReviewBootstrap> {
  const ctx = await detectRepoContext(repoCwd);
  if (!ctx) {
    return { client: null, status: null, error: "Not a git repository" };
  }

  const client = createGitClient(ctx);
  const status = await client.getRepoStatus({ includeUntracked: false }).catch(() => null);

  return { client, status, error: status ? null : "Failed to load git status" };
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
  const [fileTrees, setFileTrees] = useState<{
    staged: FileTreeSnapshot;
    changes: FileTreeSnapshot;
    compare: FileTreeSnapshot;
  }>({
    staged: gitStatusParser.buildFileTreeSnapshot([]),
    changes: gitStatusParser.buildFileTreeSnapshot([]),
    compare: gitStatusParser.buildFileTreeSnapshot([]),
  });

  const latestStatusRef = useRef<GitRepoStatus | null>(null);
  const latestCompareRef = useRef<CompareState | null>(null);
  const compareResolutionRef = useRef<CompareResolution | null>(null);
  const statusRevision = useRef(0);
  const compareRevision = useRef(0);
  const monitorRef = useRef<{ dispose: () => Promise<void> } | null>(null);
  const fileTreeSignatureRef = useRef({ staged: "", changes: "", compare: "" });

  useEffect(() => {
    if (bootstrap) {
      let cancelled = false;

      void bootstrap.then((nextBootstrap) => {
        if (cancelled) return;
        setClient(nextBootstrap.client);
        setStatus(nextBootstrap.status);
        setError(nextBootstrap.error);
        latestStatusRef.current = nextBootstrap.status;
      });

      return () => {
        cancelled = true;
      };
    }

    void bootstrapReviewSession(repoCwd).then((nextBootstrap) => {
      setClient(nextBootstrap.client);
      setStatus(nextBootstrap.status);
      setError(nextBootstrap.error);
      latestStatusRef.current = nextBootstrap.status;
    });
  }, [bootstrap, repoCwd]);

  const refreshStatus = useCallback(() => {
    if (!client) return;

    client
      .getRepoStatus()
      .then((nextStatus) => {
        const normalized = nextStatus
          ? { ...nextStatus, files: { ...nextStatus.files } }
          : nextStatus;
        if (dequal(latestStatusRef.current, normalized)) return;
        latestStatusRef.current = normalized;
        setStatus(normalized);
      })
      .catch(() => setStatus(null));
  }, [client]);

  useEffect(() => {
    if (!client) return;
    refreshStatus();
  }, [client, refreshStatus, statusRevision.current]);

  const refreshCompare = useCallback(() => {
    if (!client || !compareState) return;

    void (async () => {
      try {
        const nextFiles =
          compareState.mode === "single-commit" && compareState.targetRef
            ? await client.getCommitDiffFiles(compareState.targetRef)
            : compareState.mode === "base-commit"
              ? await getRevisionDiffFiles(
                  compareState.baseRef,
                  compareState.compareRef,
                  client.ctx.cwd,
                )
              : await getBranchDiffFiles(compareState.compareRef, client.ctx.cwd);

        const nextState = { ...compareState, files: nextFiles };
        if (dequal(latestCompareRef.current, nextState)) return;
        latestCompareRef.current = nextState;
        setCompareState(nextState);
      } catch {
        // ignore transient refresh failures
      }
    })();
  }, [client, compareState]);

  const startCompare = useCallback(
    async (target: CompareTarget): Promise<CompareState | null> => {
      if (!client) return null;

      try {
        const { resolution, files } = await resolveCompareFiles(client, target);
        const nextState = compareStateFromResolution(target, resolution, files);
        latestCompareRef.current = nextState;
        compareResolutionRef.current = resolution;
        setCompareState(nextState);
        return nextState;
      } catch {
        return null;
      }
    },
    [client],
  );

  const stopCompare = useCallback(() => {
    latestCompareRef.current = null;
    compareResolutionRef.current = null;
    setCompareState(null);
  }, []);

  const runGitAction = useCallback(
    (action: () => Promise<void>) => {
      if (!client) return;
      action()
        .then(() => {
          statusRevision.current += 1;
          compareRevision.current += 1;
          refreshStatus();
          refreshCompare();
        })
        .catch(() => {});
    },
    [client, refreshCompare, refreshStatus],
  );

  useEffect(() => {
    if (!client || monitorRef.current) return;

    let cancelled = false;

    void createRepoMonitor(client.ctx, () => {
      if (cancelled) return;
      statusRevision.current += 1;
      compareRevision.current += 1;
      refreshStatus();
      refreshCompare();
    }).then((monitor) => {
      if (cancelled) {
        void monitor.dispose();
        return;
      }

      monitorRef.current = monitor;
    });

    return () => {
      cancelled = true;
      const monitor = monitorRef.current;
      monitorRef.current = null;
      void monitor?.dispose();
    };
  }, [client, refreshCompare, refreshStatus]);

  useEffect(() => {
    const nextStatus = status ?? null;
    const nextCompare = compareState?.files ?? [];

    const nextSignatures = {
      staged: fileTreeSignature(nextStatus?.files.staged ?? []),
      changes: fileTreeSignature([
        ...(nextStatus?.files.changes ?? []),
        ...(nextStatus?.files.untracked ?? []),
      ]),
      compare: fileTreeSignature(nextCompare),
    };

    if (
      nextSignatures.staged === fileTreeSignatureRef.current.staged &&
      nextSignatures.changes === fileTreeSignatureRef.current.changes &&
      nextSignatures.compare === fileTreeSignatureRef.current.compare
    ) {
      return;
    }

    fileTreeSignatureRef.current = nextSignatures;

    setFileTrees({
      staged: gitStatusParser.buildFileTreeSnapshot(nextStatus?.files.staged ?? []),
      changes: gitStatusParser.buildFileTreeSnapshot([
        ...(nextStatus?.files.changes ?? []),
        ...(nextStatus?.files.untracked ?? []),
      ]),
      compare: gitStatusParser.buildFileTreeSnapshot(nextCompare),
    });
  }, [compareState?.files, status]);

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
      compareState,
      error,
      fileTrees,
      refreshCompare,
      refreshStatus,
      runGitAction,
      startCompare,
      status,
      stopCompare,
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
  if (!context) throw new Error("useReviewSession must be used within a ReviewProvider");
  return context;
}
