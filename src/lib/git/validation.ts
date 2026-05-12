import { Result } from "better-result";

import { GitInvalidArgumentError } from "./errors";
import type { GitResult } from "./types";

export function invalidGitArgument(
  argument: string,
  value: unknown,
  message: string,
): GitInvalidArgumentError {
  return new GitInvalidArgumentError({ argument, value, message });
}

export function validateGitRef(
  ref: string,
  argument = "ref",
): GitResult<string, GitInvalidArgumentError> {
  const trimmed = ref.trim();

  if (!trimmed) {
    return Result.err(
      invalidGitArgument(argument, ref, `Expected a non-empty git ${argument}`),
    );
  }

  if (trimmed.startsWith("-")) {
    return Result.err(
      invalidGitArgument(argument, ref, `Expected git ${argument} to not start with '-'`),
    );
  }

  return Result.ok(trimmed);
}

export function validatePositiveInteger(
  value: number | undefined,
  argument: string,
): GitResult<number | undefined, GitInvalidArgumentError> {
  if (value === undefined) return Result.ok(undefined);

  if (!Number.isInteger(value) || value <= 0) {
    return Result.err(
      invalidGitArgument(argument, value, `Expected ${argument} to be a positive integer`),
    );
  }

  return Result.ok(value);
}

export function validateNonNegativeInteger(
  value: number | undefined,
  argument: string,
): GitResult<number | undefined, GitInvalidArgumentError> {
  if (value === undefined) return Result.ok(undefined);

  if (!Number.isInteger(value) || value < 0) {
    return Result.err(
      invalidGitArgument(argument, value, `Expected ${argument} to be a non-negative integer`),
    );
  }

  return Result.ok(value);
}
