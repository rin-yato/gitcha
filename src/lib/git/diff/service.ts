import type { GitExecutorLike, GitResult, GitUnifiedDiffTarget } from "../types";
import { buildUnifiedDiffArgs } from "./command";

export type GitDiffServiceClient = {
  getExecutorCwd(): Promise<string | undefined>;
  executor: Pick<GitExecutorLike, "runText">;
};

export class GitDiffService {
  constructor(private readonly client: GitDiffServiceClient) {}

  async get(file: GitUnifiedDiffTarget): Promise<GitResult<string>> {
    const cwd = await this.client.getExecutorCwd();

    return this.client.executor.runText(buildUnifiedDiffArgs(file), {
      cwd,
      dedupe: true,
      successExitCodes: [0, 1],
    });
  }
}
