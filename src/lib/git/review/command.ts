import { FULL_DIFF_CONTEXT_LINES } from "../diff";
import type { GitReviewResolution, GitUnifiedDiffTarget } from "../types";

export const WORKTREE_COMPARE_REF = "WORKTREE";

export function buildReviewNameStatusArgs(resolution: GitReviewResolution): string[] {
  if (resolution.isRootCommit && resolution.targetRef) {
    return [
      "diff-tree",
      "--root",
      "--no-commit-id",
      "--name-status",
      "-z",
      "-r",
      "-M",
      resolution.targetRef,
      "--",
    ];
  }

  const args = ["diff", "--name-status", "-z", "-M"];
  if (resolution.baseRef) args.push(resolution.baseRef);
  if (resolution.compareRef) args.push(resolution.compareRef);
  args.push("--");
  return args;
}

function isUntrackedFile(file: GitUnifiedDiffTarget): boolean {
  return file.indexStatus === "?" || file.workingTreeStatus === "?";
}

export function buildReviewDiffArgs(
  resolution: GitReviewResolution,
  file: GitUnifiedDiffTarget,
): string[] {
  if (isUntrackedFile(file) && resolution.compareRef === null) {
    return [
      "diff",
      "--no-index",
      `--unified=${FULL_DIFF_CONTEXT_LINES}`,
      "--no-ext-diff",
      "--",
      "/dev/null",
      file.path,
    ];
  }

  if (resolution.isRootCommit && resolution.targetRef) {
    return [
      "show",
      "--format=",
      "--root",
      `--unified=${FULL_DIFF_CONTEXT_LINES}`,
      "--no-ext-diff",
      resolution.targetRef,
      "--",
      file.path,
    ];
  }

  const args = ["diff", `--unified=${FULL_DIFF_CONTEXT_LINES}`, "--no-ext-diff", "-M"];
  if (resolution.baseRef) args.push(resolution.baseRef);
  if (resolution.compareRef) args.push(resolution.compareRef);
  args.push("--", file.path);
  return args;
}
