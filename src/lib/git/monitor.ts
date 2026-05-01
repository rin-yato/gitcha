import path from "path";

import { execGit, getRepoStatus } from "./commands";
import type { RepoChangeListener, RepoContext, RepoMonitor } from "./types";

const POLL_INTERVAL_MS = 1000;
const WATCH_SETTLE_DELAY_MS = 100;

type IgnoredPathCache = {
  exactPaths: Set<string>;
  directoryPrefixes: string[];
};

function isGitDirPath(filePath: string, repoGitDir: string, repoGitDirPrefix: string): boolean {
  return filePath === repoGitDir || filePath.startsWith(repoGitDirPrefix);
}

function normalizeWatchedPath(filePath: string): string {
  return path.resolve(filePath);
}

export async function loadIgnoredPathCache(ctx: RepoContext): Promise<IgnoredPathCache> {
  const output = await execGit(
    ["ls-files", "-oi", "--exclude-standard", "--directory", "--no-empty-directory"],
    { cwd: ctx.root },
  ).catch(() => "");

  const exactPaths = new Set<string>();
  const directoryPrefixes: string[] = [];

  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const isDirectory = line.endsWith("/");
    const relativePath = isDirectory ? line.slice(0, -1) : line;
    if (!relativePath) continue;

    const absolutePath = normalizeWatchedPath(path.join(ctx.root, relativePath));
    if (isDirectory) {
      directoryPrefixes.push(`${absolutePath}${path.sep}`);
      continue;
    }

    exactPaths.add(absolutePath);
  }

  directoryPrefixes.sort((left, right) => right.length - left.length);

  return { exactPaths, directoryPrefixes };
}

export function pathIsIgnored(
  filePath: string,
  root: string,
  cache: IgnoredPathCache,
): boolean {
  const normalized = path.isAbsolute(filePath)
    ? normalizeWatchedPath(filePath)
    : normalizeWatchedPath(path.join(root, filePath));

  if (cache.exactPaths.has(normalized)) return true;

  return cache.directoryPrefixes.some((prefix) => normalized.startsWith(prefix));
}

function createIgnoredMatcher(ctx: RepoContext, cacheGetter: () => IgnoredPathCache) {
  return (filePath: string) => {
    const repoGitDir = path.join(ctx.root, ".git");
    if (isGitDirPath(filePath, repoGitDir, `${repoGitDir}${path.sep}`)) {
      return false;
    }

    if (
      filePath.includes(`${path.sep}node_modules${path.sep}`) ||
      filePath.endsWith(`${path.sep}node_modules`)
    ) {
      return true;
    }

    return pathIsIgnored(filePath, ctx.root, cacheGetter());
  };
}

function serializeRepoStatus(ctx: RepoContext): Promise<string> {
  return getRepoStatus(ctx.cwd, { includeUntracked: true }).then((status) =>
    JSON.stringify({
      branch: status.branch,
      upstream: status.upstream,
      aheadCount: status.aheadCount,
      behindCount: status.behindCount,
      files: status.files,
    }),
  );
}

function createPollingMonitor(ctx: RepoContext, onChange: RepoChangeListener): RepoMonitor {
  let disposed = false;
  let inFlight = false;
  let previousSignature: string | null = null;

  const refresh = async () => {
    if (disposed || inFlight) return;
    inFlight = true;

    try {
      const signature = await serializeRepoStatus(ctx);

      if (previousSignature === null) {
        previousSignature = signature;
        return;
      }

      if (signature !== previousSignature) {
        previousSignature = signature;
        onChange("content");
      }
    } catch {
      // Ignore transient git errors while polling.
    } finally {
      inFlight = false;
    }
  };

  void refresh();

  const timer = setInterval(() => {
    void refresh();
  }, POLL_INTERVAL_MS);

  return {
    mode: "polling",
    dispose: async () => {
      disposed = true;
      clearInterval(timer);
    },
  };
}

async function createChokidarMonitor(
  ctx: RepoContext,
  onChange: RepoChangeListener,
): Promise<RepoMonitor | null> {
  try {
    const { default: chokidar } = await import("chokidar");
    const repoGitDir = path.join(ctx.root, ".git");
    const repoGitDirPrefix = `${repoGitDir}${path.sep}`;
    let ignoredPathCache = await loadIgnoredPathCache(ctx);

    let disposed = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const ignored = createIgnoredMatcher(ctx, () => ignoredPathCache);
    const refreshIgnoredPathCache = async () => {
      ignoredPathCache = await loadIgnoredPathCache(ctx).catch(() => ignoredPathCache);
    };

    const watcher = chokidar.watch(ctx.root, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: WATCH_SETTLE_DELAY_MS,
        pollInterval: WATCH_SETTLE_DELAY_MS,
      },
      ignored,
    });

    const scheduleContentChange = () => {
      if (disposed) return;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        if (!disposed) onChange("content");
      }, WATCH_SETTLE_DELAY_MS);
    };

    const onAll = (event: string, filePath: string) => {
      if (disposed) return;

      if (isGitDirPath(filePath, repoGitDir, repoGitDirPrefix)) {
        onChange("metadata");
        void refreshIgnoredPathCache();
        return;
      }

      if (filePath.endsWith(`${path.sep}.gitignore`)) {
        onChange("metadata");
        void refreshIgnoredPathCache();
        return;
      }

      if (event === "addDir" || event === "unlinkDir") {
        onChange("metadata");
        return;
      }

      scheduleContentChange();
    };

    watcher.on("all", onAll);
    watcher.on("error", () => {
      if (!disposed) onChange("metadata");
    });

    return {
      mode: "native",
      dispose: async () => {
        disposed = true;
        if (timeout) clearTimeout(timeout);
        await watcher.close();
      },
    };
  } catch {
    return null;
  }
}

export async function createRepoMonitor(
  ctx: RepoContext,
  onChange: RepoChangeListener,
): Promise<RepoMonitor> {
  return (await createChokidarMonitor(ctx, onChange)) ?? createPollingMonitor(ctx, onChange);
}
