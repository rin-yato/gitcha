import { Result } from "better-result";

import type { GitBranch, GitBranchListOptions, GitExecutorLike, GitResult } from "../types";
import { BRANCH_LIST_FORMAT, parseBranches } from "./parser";

export type GitBranchServiceClient = {
  getExecutorCwd(): Promise<string | undefined>;
  executor: Pick<GitExecutorLike, "runText">;
};

function branchRefs(scope: GitBranchListOptions["scope"]): string[] {
  if (scope === "local") return ["refs/heads"];
  if (scope === "remote") return ["refs/remotes"];
  return ["refs/heads", "refs/remotes"];
}

export class GitBranchService {
  constructor(private readonly client: GitBranchServiceClient) {}

  async list(options: GitBranchListOptions = {}): Promise<GitResult<GitBranch[]>> {
    const cwd = await this.client.getExecutorCwd();
    const output = await this.client.executor.runText(
      ["for-each-ref", `--format=${BRANCH_LIST_FORMAT}`, ...branchRefs(options.scope)],
      {
        cwd,
        dedupe: true,
      },
    );

    if (Result.isError(output)) return Result.err(output.error);

    return parseBranches(output.value);
  }
}
