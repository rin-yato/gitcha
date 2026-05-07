import { Result } from "better-result";

import { GitRepositoryStateError } from "./errors";
import { GitExecutor } from "./executor";
import { gitStatusParser } from "./parser";
import type {
  GitClientOptions,
  GitExecutorLike,
  GitRepoStatus,
  GitResult,
  RepoContext,
} from "./types";

export type { GitClientOptions, GitFileStatus, GitResult, GitStatusFile } from "./types";

export class Git {
  readonly cwd?: string;
  readonly executor: GitExecutorLike;
  private repoContextPromise?: Promise<GitResult<RepoContext | null>>;

  constructor(options: GitClientOptions = {}) {
    this.cwd = options.cwd;
    this.executor =
      options.executor ??
      new GitExecutor({
        binary: options.binary,
        maxConcurrency: options.maxConcurrency,
        timeoutMs: options.timeoutMs,
      });
  }

  async getRepoRoot(): Promise<GitResult<string>> {
    const result = await this.getRepoContext();

    if (result.isErr()) return Result.err(result.error);

    if (result.value) return Result.ok(result.value.root);

    return Result.err(
      new GitRepositoryStateError({
        message: "Not a git repository",
        operation: "rev-parse --show-toplevel",
        stderr: "",
      }),
    );
  }

  async getExecutorCwd(): Promise<string | undefined> {
    return this.getRepoRoot().then(Result.unwrapOr(this.cwd));
  }

  async getRepoContext(): Promise<GitResult<RepoContext | null>> {
    this.repoContextPromise ??= this.executor
      .runText(["rev-parse", "--show-toplevel"], {
        cwd: this.cwd,
        dedupe: true,
      })
      .then((result) => {
        if (Result.isError(result)) return Result.ok(null);

        const root = result.value.trim();
        const cwd = this.cwd ?? process.cwd();
        return Result.ok({
          root,
          cwd,
          toRootPath: (relativePath: string) =>
            relativePath.startsWith("/") ? relativePath : `${root}/${relativePath}`,
          toRelativePath: (absolutePath: string) =>
            absolutePath.startsWith(root) ? absolutePath.slice(root.length + 1) : absolutePath,
        });
      });

    return this.repoContextPromise;
  }

  async getRepoStatus(): Promise<GitResult<GitRepoStatus>> {
    const cwd = await this.getExecutorCwd();

    const output = await this.executor.runText(
      ["status", "--porcelain=v1", "-z", "--branch", "--untracked-files=all"],
      {
        cwd,
        dedupe: true,
      },
    );

    if (Result.isError(output)) return Result.err(output.error);

    return gitStatusParser
      .parseRepoStatus(output.value, true)
      .map((parsed) => gitStatusParser.toRepoStatus(parsed));
  }

  async getUnifiedDiff(file: {
    path: string;
    indexStatus: string;
    workingTreeStatus: string;
  }): Promise<GitResult<string>> {
    const cwd = await this.getExecutorCwd();

    const options = {
      cwd,
      dedupe: true,
      successExitCodes: [0, 1],
    } as const;

    if (file.indexStatus === "?" || file.workingTreeStatus === "?") {
      return this.executor.runText(
        [
          "diff",
          "--no-index",
          "--unified=999999999",
          "--no-ext-diff",
          "--",
          "/dev/null",
          file.path,
        ],
        options,
      );
    }

    if (file.indexStatus === "U" || file.workingTreeStatus === "U") {
      return this.executor.runText(
        ["diff", "--cc", "--unified=999999999", "--no-ext-diff", "--", file.path],
        options,
      );
    }

    if (file.indexStatus !== " " && file.workingTreeStatus === " ") {
      return this.executor.runText(
        ["diff", "--cached", "--unified=999999999", "--no-ext-diff", "--", file.path],
        options,
      );
    }

    return this.executor.runText(
      ["diff", "--unified=999999999", "--no-ext-diff", "--", file.path],
      options,
    );
  }
}

export const git = new Git();
