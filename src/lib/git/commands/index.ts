import type { GitCommandDependencies } from "../types";
import { createBranchCommands } from "./branch";
import { createDiffCommands } from "./diff";
import { createLogCommands } from "./log";
import { createRepoCommands } from "./repo";
import { createStatusCommands } from "./status";

export function createGitCommands(deps: GitCommandDependencies) {
  const repo = createRepoCommands(deps);
  const status = createStatusCommands(deps);
  const log = createLogCommands(deps);
  const branch = createBranchCommands(deps, {
    getCurrentBranch: status.getCurrentBranch,
    getCurrentBranchUpstream: status.getCurrentBranchUpstream,
    getRootCommit: log.getRootCommit,
  });
  const diff = createDiffCommands(deps, {
    getRepoRoot: repo.getRepoRoot,
  });

  return { branch, diff, log, repo, status };
}

export * from "./branch";
export * from "./diff";
export * from "./log";
export * from "./repo";
export * from "./status";
