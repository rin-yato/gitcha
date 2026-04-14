import { bunFs, type FsBackend } from "@/lib/fs";

import { getRepoRoot } from "./commands";

export interface RepoContext {
  root: string;
  cwd: string;
  backend: FsBackend;
  toRootPath: (relativePath: string) => string;
  toRelativePath: (absolutePath: string) => string;
}

export async function detectRepoContext(cwd?: string): Promise<RepoContext | null> {
  const resolvedCwd = cwd ?? process.cwd();

  let root: string;
  try {
    root = await getRepoRoot(resolvedCwd);
  } catch {
    return null;
  }

  const backend = bunFs;

  const toRootPath = (relativePath: string): string => {
    if (relativePath.startsWith("/")) return relativePath;
    return `${root}/${relativePath}`;
  };

  const toRelativePath = (absolutePath: string): string => {
    if (!absolutePath.startsWith(root)) return absolutePath;
    return absolutePath.slice(root.length + 1);
  };

  return { root, cwd: resolvedCwd, backend, toRootPath, toRelativePath };
}
