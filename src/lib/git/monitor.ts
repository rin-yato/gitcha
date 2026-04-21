import watcher from "@parcel/watcher";

import type { RepoChangeListener, RepoContext, RepoMonitor } from "./types";

class ParcelWatcherMonitor implements RepoMonitor {
  constructor(private readonly unsubscribe: () => Promise<void>) {}

  dispose(): Promise<void> {
    return this.unsubscribe();
  }
}

export async function createRepoMonitor(
  ctx: RepoContext,
  onChange: RepoChangeListener,
): Promise<RepoMonitor> {
  const subscription = await watcher.subscribe(
    ctx.root,
    (error, events) => {
      if (error) {
        onChange("metadata");
        return;
      }

      const hasMetadataChange = events.some(
        (event) => event.path === ".git" || event.path.startsWith(".git/"),
      );
      onChange(hasMetadataChange ? "metadata" : "content");
    },
    {
      ignore: ["**/node_modules/**"],
    },
  );

  return new ParcelWatcherMonitor(() => subscription.unsubscribe());
}
