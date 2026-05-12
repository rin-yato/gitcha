import { Result } from "better-result";

import { GitRepositoryStateError } from "../errors";
import type { GitCommit, GitCommitQuery, GitExecutorLike, GitResult } from "../types";
import { invalidGitArgument, validateGitRef } from "../validation";
import { buildCommitLogArgs } from "./command";
import { parseCommits } from "./parser";

export type GitCommitServiceClient = {
  getExecutorCwd(): Promise<string | undefined>;
  executor: Pick<GitExecutorLike, "runText">;
};

export class GitCommitService {
  constructor(private readonly client: GitCommitServiceClient) {}

  async list(query: GitCommitQuery = {}): Promise<GitResult<GitCommit[]>> {
    const args = buildCommitLogArgs(query);
    if (Result.isError(args)) return Result.err(args.error);

    const cwd = await this.client.getExecutorCwd();
    const output = await this.client.executor.runText(args.value, {
      cwd,
      dedupe: true,
    });

    if (Result.isError(output)) return Result.err(output.error);

    return parseCommits(output.value);
  }

  async search(
    search: string,
    query: Omit<GitCommitQuery, "search"> = {},
  ): Promise<GitResult<GitCommit[]>> {
    const trimmed = search.trim();
    if (!trimmed) {
      return Result.err(
        invalidGitArgument("search", search, "Expected search to be non-empty"),
      );
    }

    return this.list({ ...query, search: trimmed });
  }

  async get(ref: string): Promise<GitResult<GitCommit>> {
    const validated = validateGitRef(ref);
    if (Result.isError(validated)) return Result.err(validated.error);

    const result = await this.list({ refs: [validated.value], limit: 1 });
    if (Result.isError(result)) return Result.err(result.error);

    const commit = result.value[0];
    if (commit) return Result.ok(commit);

    return Result.err(
      new GitRepositoryStateError({
        message: `Commit not found: ${validated.value}`,
        operation: "log --max-count=1",
        stderr: "",
      }),
    );
  }
}
