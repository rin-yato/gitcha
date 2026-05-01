import { Result } from "better-result";

import { gitStatusParser } from "../parser";
import type {
  GetRepoStatusOptions,
  GitCommandDependencies,
  GitRepoStatus,
  GitResult,
} from "../types";

const BRANCH_CACHE_TTL_MS = 5000;
const MERGE_BASE_CACHE_TTL_MS = 30_000;

export const EMPTY_REPO_STATUS: GitRepoStatus = {
  branch: "",
  upstream: undefined,
  aheadCount: 0,
  behindCount: 0,
  files: { staged: [], changes: [], untracked: [], conflicted: [] },
  totalFiles: 0,
  isRepo: false,
};

export function createStatusCommands(deps: GitCommandDependencies) {
  const cwd = deps.cwd;

  return {
    getRepoStatus: async (
      options: GetRepoStatusOptions = {},
    ): Promise<GitResult<GitRepoStatus>> => {
      const includeUntracked = options.includeUntracked ?? true;
      const output = await deps.executor.runText(
        [
          "status",
          "--porcelain=v1",
          "-z",
          "--branch",
          `--untracked-files=${includeUntracked ? "all" : "no"}`,
        ],
        { cwd, dedupe: true },
      );
      if (Result.isError(output)) return output;

      return gitStatusParser
        .parseRepoStatus(output.value, true)
        .map((parsed) => gitStatusParser.toRepoStatus(parsed));
    },

    getCurrentBranch: (): Promise<GitResult<string>> =>
      deps.cache.getOrLoad(
        "status:current-branch",
        async () => {
          const output = await deps.executor.runText(["rev-parse", "--abbrev-ref", "HEAD"], {
            cwd,
            dedupe: true,
          });
          return output.map((value) => value.trim());
        },
        { ttlMs: BRANCH_CACHE_TTL_MS },
      ),

    getCurrentBranchUpstream: (): Promise<GitResult<string | null>> =>
      deps.cache.getOrLoad(
        "status:current-upstream",
        async () => {
          const output = await deps.executor.runText(
            ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
            { cwd, dedupe: true },
          );

          if (Result.isError(output)) return Result.ok(null);
          return Result.ok(output.value.trim() || null);
        },
        { ttlMs: BRANCH_CACHE_TTL_MS },
      ),

    getMergeBase: (baseRef: string): Promise<GitResult<string>> =>
      deps.cache.getOrLoad(
        `status:merge-base:${baseRef}`,
        async () => {
          const output = await deps.executor.runText(["merge-base", baseRef, "HEAD"], {
            cwd,
            dedupe: true,
          });

          if (Result.isError(output)) return Result.ok(baseRef);
          return Result.ok(output.value.trim() || baseRef);
        },
        { ttlMs: MERGE_BASE_CACHE_TTL_MS },
      ),
  };
}
