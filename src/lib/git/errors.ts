import { TaggedError } from "better-result";

type CommandContext = {
  args: readonly string[];
  cwd: string;
};

export class GitExecutionError extends TaggedError("GitExecutionError")<
  CommandContext & {
    message: string;
    exitCode: number | null;
    signal: string | null;
    stdout: string;
    stderr: string;
  }
>() {}

export class GitMissingError extends TaggedError("GitMissingError")<
  CommandContext & {
    message: string;
    cause: unknown;
  }
>() {}

export class GitTimeoutError extends TaggedError("GitTimeoutError")<
  CommandContext & {
    message: string;
    timeoutMs: number;
    stdout: string;
    stderr: string;
  }
>() {}

export class GitCancellationError extends TaggedError("GitCancellationError")<
  CommandContext & {
    message: string;
    reason: string | null;
  }
>() {}

export class GitOutputLimitError extends TaggedError("GitOutputLimitError")<
  CommandContext & {
    message: string;
    maxBufferBytes: number;
  }
>() {}

export class GitInvalidWorkingDirectoryError extends TaggedError(
  "GitInvalidWorkingDirectoryError",
)<
  CommandContext & {
    message: string;
    cause: unknown;
  }
>() {}

export class GitParseError extends TaggedError("GitParseError")<{
  message: string;
  parser: string;
  output: string;
}>() {}

export class GitRepositoryStateError extends TaggedError("GitRepositoryStateError")<{
  message: string;
  operation: string;
  stderr: string;
}>() {}

export class GitInvalidArgumentError extends TaggedError("GitInvalidArgumentError")<{
  message: string;
  argument: string;
  value: unknown;
}>() {}

export type GitError =
  | GitExecutionError
  | GitMissingError
  | GitTimeoutError
  | GitCancellationError
  | GitOutputLimitError
  | GitInvalidWorkingDirectoryError
  | GitParseError
  | GitRepositoryStateError
  | GitInvalidArgumentError;

export function formatGitError(error: GitError): string {
  if ("stderr" in error && error.stderr) {
    return `${error.message}: ${error.stderr.trim()}`;
  }

  return error.message;
}
