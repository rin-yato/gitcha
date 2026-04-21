import { bunFs, type FsBackend } from "@/lib/fs";

import { gitExecutor } from "./executor";

export interface RepoContext {
  root: string;
  cwd: string;
  backend: FsBackend;
  toRootPath: (relativePath: string) => string;
  toRelativePath: (absolutePath: string) => string;
}

export async function detectRepoContext(cwd?: string): Promise<RepoContext | null> {
  const resolvedCwd = cwd ?? process.cwd();
  const root = await gitExecutor.getRepoRoot(resolvedCwd).catch(() => null);
  if (!root) return null;

  const backend = bunFs;

  return {
    root,
    cwd: resolvedCwd,
    backend,
    toRootPath: (relativePath: string): string =>
      relativePath.startsWith("/") ? relativePath : `${root}/${relativePath}`,
    toRelativePath: (absolutePath: string): string =>
      absolutePath.startsWith(root) ? absolutePath.slice(root.length + 1) : absolutePath,
  };
}
