import path from "path";

import { gitStatusParser } from "./parser";
import type { RepoChangeListener, RepoContext, RepoMonitor } from "./types";

const POLL_INTERVAL_MS = 1000;
const WATCH_SETTLE_DELAY_MS = 100;

function serializeRepoStatus(ctx: RepoContext): Promise<string> {
  return gitStatusParser.getRepoStatus(ctx.cwd, { includeUntracked: true }).then((status) =>
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

    let disposed = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;

    const watcher = chokidar.watch(ctx.root, {
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: WATCH_SETTLE_DELAY_MS,
        pollInterval: WATCH_SETTLE_DELAY_MS,
      },
      ignored: (filePath) => {
        return (
          filePath.includes(`${path.sep}node_modules${path.sep}`) ||
          filePath.endsWith(`${path.sep}node_modules`)
        );
      },
    });

    const scheduleContentChange = () => {
      if (disposed) return;
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        timeout = null;
        if (!disposed) onChange("content");
      }, WATCH_SETTLE_DELAY_MS);
    };

    const onAll = (event: string, path: string) => {
      if (disposed) return;

      if (path === repoGitDir || path.startsWith(repoGitDirPrefix)) {
        onChange("metadata");
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
