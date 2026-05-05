import { bunFs } from "@/lib/fs";

import { Result } from "better-result";

import type { GitCommandDependencies, GitResult, RepoContext } from "../types";

const REPO_ROOT_TTL_MS = Number.POSITIVE_INFINITY;

function repoContext(root: string, cwd: string): RepoContext {
  return {
    root,
    cwd,
    backend: bunFs,
    toRootPath: (relativePath: string): string =>
      relativePath.startsWith("/") ? relativePath : `${root}/${relativePath}`,
    toRelativePath: (absolutePath: string): string =>
      absolutePath.startsWith(root) ? absolutePath.slice(root.length + 1) : absolutePath,
  };
}

export function createRepoCommands(deps: GitCommandDependencies) {
  const cwd = deps.cwd;

  const getRepoRoot = (): Promise<GitResult<string>> =>
    deps.cache.getOrLoad(
      "repo:root",
      async () => {
        const output = await deps.executor.runText(["rev-parse", "--show-toplevel"], {
          cwd,
          dedupe: true,
        });
        return output.map((value) => value.trim());
      },
      { ttlMs: REPO_ROOT_TTL_MS },
    );

  const isGitRepo = async (): Promise<GitResult<boolean>> => {
    const root = await getRepoRoot();
    return Result.ok(Result.isOk(root));
  };

  const detectRepoContext = async (): Promise<GitResult<RepoContext | null>> => {
    const root = await getRepoRoot();
    if (Result.isError(root)) return Result.ok(null);

    return Result.ok(repoContext(root.value, cwd ?? process.cwd()));
  };

  const runMutation = async (args: readonly string[], options: { input?: string } = {}) => {
    const root = await getRepoRoot();
    if (Result.isError(root)) return root.map(() => undefined);

    const result = await deps.executor.runText(args, {
      cwd: root.value,
      input: options.input,
    });
    if (Result.isOk(result)) deps.cache.invalidate();
    return result.map(() => undefined);
  };

  return {
    getRepoRoot,
    isGitRepo,
    detectRepoContext,
    stageFile: (filePath: string) => runMutation(["add", "--", filePath]),
    unstageFile: (filePath: string) => runMutation(["reset", "HEAD", "--", filePath]),
    discardChanges: async (filePath: string): Promise<GitResult<void>> => {
      const checkout = await runMutation(["checkout", "--", filePath]);
      if (Result.isOk(checkout)) return checkout;

      return runMutation(["clean", "-f", "--", filePath]);
    },
    commitChanges: (message: string) =>
      runMutation(["commit", "--file", "-"], { input: `${message.trim()}\n` }),
    pushChanges: () => runMutation(["push"]),
    pullChanges: () => runMutation(["pull", "--ff-only"]),
  };
}
