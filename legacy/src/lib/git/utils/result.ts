import type { Result as ResultType } from "better-result";
import { Result } from "better-result";

import { formatGitError, type GitError } from "../errors";

export function unwrapGitResult<T>(result: ResultType<T, GitError>): T {
  if (Result.isOk(result)) return result.value;
  throw new Error(formatGitError(result.error));
}

export function valueOr<T>(result: ResultType<T, GitError>, fallback: T): T {
  return Result.isOk(result) ? result.value : fallback;
}

export async function promiseValueOr<T>(
  result: Promise<ResultType<T, GitError>>,
  fallback: T,
): Promise<T> {
  return valueOr(await result, fallback);
}
