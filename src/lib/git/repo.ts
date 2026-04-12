import { bunFs, type FsBackend } from "@/lib/fs";

import { execGit, getRepoRoot } from "./commands";

export interface RepoContext {
  root: string;
  cwd: string;
  backend: FsBackend;
  toRootPath: (relativePath: string) => string;
  toRelativePath: (absolutePath: string) => string;
}

export async function detectRepoContext(cwd?: string): Promise<RepoContext | null> {
  const resolvedCwd = cwd ?? process.cwd();

  const isRepo = await execGit(["rev-parse", "--is-inside-work-tree"], {
    cwd: resolvedCwd,
  })
    .then((s) => s.trim() === "true")
    .catch(() => false);

  if (!isRepo) return null;

  const root = await getRepoRoot(resolvedCwd);
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
