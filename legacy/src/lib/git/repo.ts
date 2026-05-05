import { bunFs } from "@/lib/fs";

import { getRepoRoot } from "./commands";
import type { RepoContext } from "./types";

export type { RepoContext } from "./types";

export async function detectRepoContext(cwd?: string): Promise<RepoContext | null> {
  const resolvedCwd = cwd ?? process.cwd();
  const root = await getRepoRoot(resolvedCwd).catch(() => null);
  if (!root) return null;

  return {
    root,
    cwd: resolvedCwd,
    backend: bunFs,
    toRootPath: (relativePath: string): string =>
      relativePath.startsWith("/") ? relativePath : `${root}/${relativePath}`,
    toRelativePath: (absolutePath: string): string =>
      absolutePath.startsWith(root) ? absolutePath.slice(root.length + 1) : absolutePath,
  };
}
