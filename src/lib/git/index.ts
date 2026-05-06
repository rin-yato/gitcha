import { Result } from "better-result";

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

  getRepoRoot(): Promise<GitResult<string>> {
    return this.executor.runText(["rev-parse", "--show-toplevel"], {
      cwd: this.cwd,
      dedupe: true,
    });
  }

  async getRepoStatus(): Promise<GitResult<GitRepoStatus>> {
    const output = await this.executor.runText(
      ["status", "--porcelain=v1", "-z", "--branch", "--untracked-files=all"],
      {
        cwd: this.cwd,
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
    const options = {
      cwd: this.cwd,
      dedupe: true,
      successExitCodes: [0, 1],
    } as const;

    if (file.indexStatus === "?" || file.workingTreeStatus === "?") {
      return this.executor.runText(
        ["diff", "--no-index", "--no-ext-diff", "--", "/dev/null", file.path],
        options,
      );
    }

    if (file.indexStatus === "U" || file.workingTreeStatus === "U") {
      return this.executor.runText(["diff", "--cc", "--no-ext-diff", "--", file.path], options);
    }

    if (file.indexStatus !== " " && file.workingTreeStatus === " ") {
      return this.executor.runText(
        ["diff", "--cached", "--unified=3", "--no-ext-diff", "--", file.path],
        options,
      );
    }

    return this.executor.runText(
      ["diff", "--unified=3", "--no-ext-diff", "--", file.path],
      options,
    );
  }

  async detectRepoContext(): Promise<GitResult<RepoContext | null>> {
    return this.getRepoRoot().then((root) => {
      if (Result.isError(root)) return Result.ok(null);

      const cwd = this.cwd ?? process.cwd();
      return Result.ok({
        root: root.value,
        cwd,
        toRootPath: (relativePath: string) =>
          relativePath.startsWith("/") ? relativePath : `${root.value}/${relativePath}`,
        toRelativePath: (absolutePath: string) =>
          absolutePath.startsWith(root.value)
            ? absolutePath.slice(root.value.length + 1)
            : absolutePath,
      });
    });
  }
}

export const git = new Git();
