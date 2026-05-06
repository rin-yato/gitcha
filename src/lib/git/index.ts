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
    return this.executor
      .runText(["status", "--porcelain=v1", "-z", "--branch", "--untracked-files=all"], {
        cwd: this.cwd,
        dedupe: true,
      })
      .then((output) =>
        Result.isError(output)
          ? output
          : gitStatusParser
              .parseRepoStatus(output.value, true)
              .map((parsed) => gitStatusParser.toRepoStatus(parsed)),
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
