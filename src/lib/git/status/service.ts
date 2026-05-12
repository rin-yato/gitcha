import { Result } from "better-result";

import type { GitExecutorLike, GitRepoStatus, GitResult } from "../types";
import { parseRepoStatus, toRepoStatus } from "./parser";

export type GitStatusServiceClient = {
  getExecutorCwd(): Promise<string | undefined>;
  executor: Pick<GitExecutorLike, "runText">;
};

export class GitStatusService {
  constructor(private readonly client: GitStatusServiceClient) {}

  async get(): Promise<GitResult<GitRepoStatus>> {
    const cwd = await this.client.getExecutorCwd();

    const output = await this.client.executor.runText(
      ["status", "--porcelain=v1", "-z", "--branch", "--untracked-files=all"],
      {
        cwd,
        dedupe: true,
      },
    );

    if (Result.isError(output)) return Result.err(output.error);

    return parseRepoStatus(output.value, true).map((parsed) => toRepoStatus(parsed));
  }
}
