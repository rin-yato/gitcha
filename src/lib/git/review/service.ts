import { Result } from "better-result";

import { parseNameStatus, toStatusFiles } from "../diff";
import { GitRepositoryStateError } from "../errors";
import { categorizeFiles, parseNulList } from "../status";
import type {
  GitExecutorLike,
  GitResult,
  GitReviewResolution,
  GitReviewStatus,
  GitReviewTarget,
  GitUnifiedDiffTarget,
} from "../types";
import { validateGitRef } from "../validation";
import {
  buildReviewDiffArgs,
  buildReviewNameStatusArgs,
  WORKTREE_COMPARE_REF,
} from "./command";

export type GitReviewServiceClient = {
  getExecutorCwd(): Promise<string | undefined>;
  executor: Pick<GitExecutorLike, "runText">;
};

export class GitReviewService {
  constructor(private readonly client: GitReviewServiceClient) {}

  async resolve(target: GitReviewTarget): Promise<GitResult<GitReviewResolution>> {
    const cwd = await this.client.getExecutorCwd();

    if (target.mode === "single-commit") {
      return this.resolveSingleCommitTarget(target, cwd);
    }

    return this.resolveBaseCommitTarget(target, cwd);
  }

  async status(target: GitReviewTarget): Promise<GitResult<GitReviewStatus>> {
    const resolution = await this.resolve(target);
    if (Result.isError(resolution)) return Result.err(resolution.error);

    const cwd = await this.client.getExecutorCwd();
    const output = await this.client.executor.runText(
      buildReviewNameStatusArgs(resolution.value),
      {
        cwd,
        dedupe: true,
      },
    );
    if (Result.isError(output)) return Result.err(output.error);

    const parsed = parseNameStatus(output.value, true);
    if (Result.isError(parsed)) return Result.err(parsed.error);

    const changedFiles = toStatusFiles(parsed.value);

    if (!resolution.value.includeUntracked) {
      return Result.ok({
        target,
        resolution: resolution.value,
        files: categorizeFiles(changedFiles),
        totalFiles: changedFiles.length,
      });
    }

    const untrackedOutput = await this.client.executor.runText(
      ["ls-files", "--others", "--exclude-standard", "-z"],
      {
        cwd,
        dedupe: true,
      },
    );
    if (Result.isError(untrackedOutput)) return Result.err(untrackedOutput.error);

    const untrackedFiles = parseNulList(untrackedOutput.value).map((path) => ({
      path,
      indexStatus: "?" as const,
      workingTreeStatus: "?" as const,
    }));
    const files = [...changedFiles, ...untrackedFiles];

    return Result.ok({
      target,
      resolution: resolution.value,
      files: categorizeFiles(files),
      totalFiles: files.length,
    });
  }

  async diff(target: GitReviewTarget, file: GitUnifiedDiffTarget): Promise<GitResult<string>> {
    const resolution = await this.resolve(target);
    if (Result.isError(resolution)) return Result.err(resolution.error);

    const cwd = await this.client.getExecutorCwd();
    return this.client.executor.runText(buildReviewDiffArgs(resolution.value, file), {
      cwd,
      dedupe: true,
      successExitCodes: [0, 1],
    });
  }

  private async resolveCommitRef(
    ref: string,
    cwd: string | undefined,
    argument = "ref",
  ): Promise<GitResult<string>> {
    const validated = validateGitRef(ref, argument);
    if (Result.isError(validated)) return Result.err(validated.error);

    const output = await this.client.executor.runText(
      ["rev-parse", "--verify", `${validated.value}^{commit}`],
      {
        cwd,
        dedupe: true,
      },
    );
    if (Result.isError(output)) return Result.err(output.error);

    const resolved = output.value.trim().split(/\r?\n/)[0];
    if (resolved) return Result.ok(resolved);

    return Result.err(
      new GitRepositoryStateError({
        message: `Commit not found: ${validated.value}`,
        operation: "rev-parse --verify",
        stderr: "",
      }),
    );
  }

  private async resolveSingleCommitTarget(
    target: Extract<GitReviewTarget, { mode: "single-commit" }>,
    cwd: string | undefined,
  ): Promise<GitResult<GitReviewResolution>> {
    const validated = validateGitRef(target.ref);
    if (Result.isError(validated)) return Result.err(validated.error);

    const output = await this.client.executor.runText(
      ["rev-list", "--parents", "-n", "1", validated.value],
      {
        cwd,
        dedupe: true,
      },
    );
    if (Result.isError(output)) return Result.err(output.error);

    const [targetRef, ...parentRefs] = output.value.trim().split(/\s+/).filter(Boolean);
    if (!targetRef) {
      return Result.err(
        new GitRepositoryStateError({
          message: `Commit not found: ${validated.value}`,
          operation: "rev-list --parents -n 1",
          stderr: "",
        }),
      );
    }

    const parentRef = parentRefs[0] ?? null;

    return Result.ok({
      mode: "single-commit",
      baseRef: parentRef,
      compareRef: targetRef,
      targetRef,
      revisionRange: parentRef ? `${parentRef}..${targetRef}` : targetRef,
      baseLabel: target.label ?? validated.value,
      isRootCommit: parentRef === null,
      includeUntracked: false,
    });
  }

  private async resolveBaseCommitTarget(
    target: Extract<GitReviewTarget, { mode: "base-commit" }>,
    cwd: string | undefined,
  ): Promise<GitResult<GitReviewResolution>> {
    const baseRef = await this.resolveCommitRef(target.ref, cwd);
    if (Result.isError(baseRef)) return Result.err(baseRef.error);

    if (target.compareRef === undefined || target.compareRef === null) {
      return Result.ok({
        mode: "base-commit",
        baseRef: baseRef.value,
        compareRef: null,
        targetRef: null,
        revisionRange: `${baseRef.value}..${WORKTREE_COMPARE_REF}`,
        baseLabel: target.label ?? target.ref,
        isRootCommit: false,
        includeUntracked: target.includeUntracked ?? true,
      });
    }

    const compareRef = await this.resolveCommitRef(target.compareRef, cwd, "compareRef");
    if (Result.isError(compareRef)) return Result.err(compareRef.error);

    return Result.ok({
      mode: "base-commit",
      baseRef: baseRef.value,
      compareRef: compareRef.value,
      targetRef: compareRef.value,
      revisionRange: `${baseRef.value}..${compareRef.value}`,
      baseLabel: target.label ?? target.ref,
      isRootCommit: false,
      includeUntracked: false,
    });
  }
}
