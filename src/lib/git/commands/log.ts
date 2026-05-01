import { Result } from "better-result";

import { gitStatusParser } from "../parser";
import type { GitCommandDependencies, GitResult, RecentCommitSummary } from "../types";

const COMMIT_METADATA_TTL_MS = Number.POSITIVE_INFINITY;
const RECENT_COMMITS_TTL_MS = 10_000;

export function createLogCommands(deps: GitCommandDependencies) {
  const cwd = deps.cwd;

  const getRecentCommitSummaries = (limit = 12): Promise<GitResult<RecentCommitSummary[]>> =>
    deps.cache.getOrLoad(
      `log:recent-summaries:${limit}`,
      async () => {
        const output = await deps.executor.runText(
          [
            "log",
            "--decorate=short",
            "--pretty=format:%H%x00%s%x00%D%x1e",
            "-n",
            String(limit),
          ],
          { cwd, dedupe: true },
        );
        return output.map((value) => gitStatusParser.parseRecentCommitSummaries(value));
      },
      { ttlMs: RECENT_COMMITS_TTL_MS },
    );

  return {
    getRootCommit: (): Promise<GitResult<string | null>> =>
      deps.cache.getOrLoad(
        "log:root-commit",
        async () => {
          const output = await deps.executor.runText(["rev-list", "--max-parents=0", "HEAD"], {
            cwd,
            dedupe: true,
          });
          return output.map((value) => gitStatusParser.parseRootCommit(value));
        },
        { ttlMs: COMMIT_METADATA_TTL_MS },
      ),

    getCommitParent: (commitRef: string): Promise<GitResult<string | null>> =>
      deps.cache.getOrLoad(
        `log:commit-parent:${commitRef}`,
        async () => {
          const output = await deps.executor.runText(
            ["rev-list", "--parents", "-n", "1", commitRef],
            { cwd, dedupe: true },
          );
          return output.map((value) => gitStatusParser.parseCommitParent(value));
        },
        { ttlMs: COMMIT_METADATA_TTL_MS },
      ),

    getRecentCommits: async (limit = 12): Promise<GitResult<string[]>> => {
      const commits = await getRecentCommitSummaries(limit);
      return commits.map((entries) =>
        entries.map((entry) => `${entry.ref}\t${entry.message}\t${entry.origin}`),
      );
    },

    getRecentCommitSummaries,

    searchCompareCommits: async (
      query: string,
      limit = 1000,
    ): Promise<GitResult<RecentCommitSummary[]>> => {
      const commits = await getRecentCommitSummaries(limit);
      if (Result.isError(commits)) return commits;

      const needle = query.trim().toLowerCase();
      if (!needle) return commits;

      return Result.ok(
        commits.value.filter((commit) =>
          `${commit.ref} ${commit.shortRef} ${commit.message} ${commit.origin}`
            .toLowerCase()
            .includes(needle),
        ),
      );
    },
  };
}
