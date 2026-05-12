import { Result } from "better-result";

import type { GitCommitQuery, GitResult } from "../types";
import {
  invalidGitArgument,
  validateGitRef,
  validateNonNegativeInteger,
  validatePositiveInteger,
} from "../validation";

export const COMMIT_LOG_FORMAT =
  "%x1e%H%x00%h%x00%s%x00%b%x00%an%x00%ae%x00%aI%x00%cI%x00%P%x00%D";

function appendQueryStringOption(
  args: string[],
  name: string,
  value: string | undefined,
): void {
  const trimmed = value?.trim();
  if (trimmed) args.push(`--${name}=${trimmed}`);
}

export function buildCommitLogArgs(query: GitCommitQuery = {}): GitResult<string[]> {
  const limit = validatePositiveInteger(query.limit, "limit");
  if (Result.isError(limit)) return Result.err(limit.error);

  const skip = validateNonNegativeInteger(query.skip, "skip");
  if (Result.isError(skip)) return Result.err(skip.error);

  const args = ["log", `--format=${COMMIT_LOG_FORMAT}`, "--decorate=short"];

  if (query.all) args.push("--all");
  if (limit.value !== undefined) args.push(`--max-count=${limit.value}`);
  if (skip.value !== undefined) args.push(`--skip=${skip.value}`);

  appendQueryStringOption(args, "author", query.author);
  appendQueryStringOption(args, "since", query.since);
  appendQueryStringOption(args, "until", query.until);

  const search = query.search?.trim();
  if (query.search !== undefined) {
    if (!search) {
      return Result.err(
        invalidGitArgument("search", query.search, "Expected search to be non-empty"),
      );
    }

    args.push("--regexp-ignore-case", `--grep=${search}`);
  }

  for (const ref of query.refs ?? []) {
    const validated = validateGitRef(ref, "refs");
    if (Result.isError(validated)) return Result.err(validated.error);
    args.push(validated.value);
  }

  if (query.path !== undefined) {
    if (!query.path) {
      return Result.err(
        invalidGitArgument("path", query.path, "Expected path to be non-empty"),
      );
    }

    args.push("--", query.path);
  }

  return Result.ok(args);
}
