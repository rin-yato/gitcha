import { Result } from "better-result";

import { gitStatusParser } from "../parser";
import type { CompareTarget, GitCommandDependencies, GitResult } from "../types";

type BranchDependencies = {
  getCurrentBranch: () => Promise<GitResult<string>>;
  getCurrentBranchUpstream: () => Promise<GitResult<string | null>>;
  getRootCommit: () => Promise<GitResult<string | null>>;
};

const BRANCH_LIST_TTL_MS = 5000;
const COMPARE_TARGET_TTL_MS = 5000;

function uniqueSorted(values: string[]): string[] {
  return [
    ...new Set(values.filter(Boolean).filter((branch) => !branch.endsWith("/HEAD"))),
  ].sort();
}

function uniqueInOrder(values: string[]): string[] {
  return [...new Set(values.filter(Boolean).filter((branch) => !branch.endsWith("/HEAD")))];
}

export function createBranchCommands(
  deps: GitCommandDependencies,
  branchDeps: BranchDependencies,
) {
  const cwd = deps.cwd;

  const getCompareBranches = (): Promise<GitResult<string[]>> =>
    deps.cache.getOrLoad(
      "branch:compare-branches",
      async () => {
        const output = await deps.executor.runText(
          ["for-each-ref", "--format=%(refname:short)", "refs/heads/", "refs/remotes/"],
          { cwd, dedupe: true },
        );
        return output.map((value) => uniqueSorted(value.split(/\r?\n/)));
      },
      { ttlMs: BRANCH_LIST_TTL_MS },
    );

  return {
    getLocalBranches: (): Promise<GitResult<string[]>> =>
      deps.cache.getOrLoad(
        "branch:local-branches",
        async () => {
          const output = await deps.executor.runText(
            ["for-each-ref", "--format=%(refname:short)", "refs/heads/"],
            { cwd, dedupe: true },
          );
          return output.map((value) => gitStatusParser.parseList(value));
        },
        { ttlMs: BRANCH_LIST_TTL_MS },
      ),

    getCompareBranches,

    searchCompareBranches: async (query: string): Promise<GitResult<string[]>> => {
      const branches = await getCompareBranches();
      if (Result.isError(branches)) return branches;

      const needle = query.trim().toLowerCase();
      return Result.ok(
        needle
          ? branches.value.filter((branch) => branch.toLowerCase().includes(needle))
          : branches.value,
      );
    },

    getCompareTarget: (): Promise<GitResult<CompareTarget | null>> =>
      deps.cache.getOrLoad(
        "branch:compare-target",
        async () => {
          const currentBranch = await branchDeps.getCurrentBranch();
          if (Result.isError(currentBranch)) return currentBranch.map(() => null);

          const upstream = await branchDeps.getCurrentBranchUpstream();
          if (Result.isError(upstream)) return upstream.map(() => null);

          if (upstream.value) {
            return Result.ok({
              mode: "base-branch",
              ref: upstream.value,
              label: upstream.value,
            });
          }

          const mergedOutput = await deps.executor.runText(
            [
              "for-each-ref",
              "--sort=-committerdate",
              "--format=%(refname:short)",
              "--merged",
              "HEAD",
              "refs/heads/",
              "refs/remotes/",
            ],
            { cwd, dedupe: true },
          );
          if (Result.isError(mergedOutput)) return mergedOutput.map(() => null);

          const mergedBranches = uniqueInOrder(mergedOutput.value.split(/\r?\n/)).filter(
            (branch) => branch !== currentBranch.value,
          );

          const bestBranch = mergedBranches[0];
          if (bestBranch) {
            return Result.ok({ mode: "base-branch", ref: bestBranch, label: bestBranch });
          }

          const rootCommit = await branchDeps.getRootCommit();
          if (Result.isError(rootCommit)) return rootCommit.map(() => null);

          return Result.ok(
            rootCommit.value
              ? { mode: "base-branch", ref: rootCommit.value, label: "root commit" }
              : null,
          );
        },
        { ttlMs: COMPARE_TARGET_TTL_MS },
      ),
  };
}
