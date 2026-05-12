import { Result } from "better-result";

import { GitBranchService } from "./branch";
import { GitCommitService } from "./commit";
import { GitDiffService } from "./diff";
import { GitRepositoryStateError } from "./errors";
import { GitExecutor } from "./executor";
import { GitReviewService } from "./review";
import { GitStatusService } from "./status";
import type { GitClientOptions, GitExecutorLike, GitResult, RepoContext } from "./types";

export type { GitBranchServiceClient } from "./branch";
export { BRANCH_LIST_FORMAT, GitBranchService, parseBranches } from "./branch";
export type { GitCommitServiceClient } from "./commit";
export {
  GitCommitService,
  parseCommitParent,
  parseCommitParentRefs,
  parseCommits,
  parseRecentCommitSummaries,
  parseRootCommit,
} from "./commit";
export type { GitDiffServiceClient, GitDiffStatusLine } from "./diff";
export {
  GitDiffService,
  parseBinaryNumstat,
  parseNameStatus,
  parseNameStatusLine,
  toStatusFiles,
} from "./diff";
export type { GitReviewServiceClient } from "./review";
export { GitReviewService } from "./review";
export type { GitStatusServiceClient, ParsedRepoStatus } from "./status";
export {
  buildFileTree,
  buildFileTreeSnapshot,
  categorizeFiles,
  collectFileTreeFiles,
  GitStatusService,
  parseNulList,
  parseRepoStatus,
  parseRepoStatusLines,
  parseStatusBranchLine,
  parseStatusLine,
  toRepoStatus,
} from "./status";
export {
  createGitFileTarget,
  createGitScopedFile,
  findGitScopedFile,
  isGitFileTargetEqual,
  toGitUnifiedDiffTarget,
} from "./target";
export type {
  GitBranch,
  GitBranchListOptions,
  GitBranchScope,
  GitClientOptions,
  GitCommit,
  GitCommitQuery,
  GitCommitReviewMode,
  GitFileSection,
  GitFileStatus,
  GitFileTarget,
  GitResult,
  GitReviewResolution,
  GitReviewStatus,
  GitReviewTarget,
  GitScopedFile,
  GitStatusFile,
  GitUnifiedDiffTarget,
} from "./types";

export class Git {
  readonly cwd?: string;
  readonly executor: GitExecutorLike;
  readonly branch: GitBranchService;
  readonly commit: GitCommitService;
  readonly diff: GitDiffService;
  readonly review: GitReviewService;
  readonly status: GitStatusService;
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
    this.branch = new GitBranchService({
      executor: this.executor,
      getExecutorCwd: () => this.getExecutorCwd(),
    });
    this.commit = new GitCommitService({
      executor: this.executor,
      getExecutorCwd: () => this.getExecutorCwd(),
    });
    this.diff = new GitDiffService({
      executor: this.executor,
      getExecutorCwd: () => this.getExecutorCwd(),
    });
    this.review = new GitReviewService({
      executor: this.executor,
      getExecutorCwd: () => this.getExecutorCwd(),
    });
    this.status = new GitStatusService({
      executor: this.executor,
      getExecutorCwd: () => this.getExecutorCwd(),
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
}

export const git = new Git();
