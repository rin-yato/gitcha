import type { GitUnifiedDiffTarget } from "../types";

export const FULL_DIFF_CONTEXT_LINES = 999_999_999;

export function buildUnifiedDiffArgs(file: GitUnifiedDiffTarget): string[] {
  if (file.indexStatus === "?" || file.workingTreeStatus === "?") {
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

  if (
    file.section === "conflicts" ||
    file.indexStatus === "U" ||
    file.workingTreeStatus === "U"
  ) {
    return [
      "diff",
      "--cc",
      `--unified=${FULL_DIFF_CONTEXT_LINES}`,
      "--no-ext-diff",
      "--",
      file.path,
    ];
  }

  if (
    file.section === "staged" ||
    (file.indexStatus !== " " && file.workingTreeStatus === " ")
  ) {
    return [
      "diff",
      "--cached",
      `--unified=${FULL_DIFF_CONTEXT_LINES}`,
      "--no-ext-diff",
      "--",
      file.path,
    ];
  }

  return ["diff", `--unified=${FULL_DIFF_CONTEXT_LINES}`, "--no-ext-diff", "--", file.path];
}
