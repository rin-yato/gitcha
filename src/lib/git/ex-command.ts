import { Result, TaggedError } from "better-result";

import type { GitError } from "./errors";
import type { GitCommandOutput, GitExecutorLike } from "./types";

export class GitExCommandParseError extends TaggedError("GitExCommandParseError")<{
  message: string;
  input: string;
  index: number;
}>() {}

export type GitExCommandError = GitExCommandParseError | GitError;

export type GitExCommandResult = {
  input: string;
  args: string[];
  output: GitCommandOutput;
};

export type GitExCommandClient = {
  getExecutorCwd(): Promise<string | undefined>;
  executor: Pick<GitExecutorLike, "run">;
};

export type GitExCommandRunOptions = {
  onStdout?: (text: string) => void;
  onStderr?: (text: string) => void;
};

const DISALLOWED_UNQUOTED_TOKENS = new Set(["|", ";", ">", "<"]);

export function getGitExCommandInput(raw: string): string {
  const trimmed = raw.trimStart();
  const withoutColon = trimmed.startsWith(":") ? trimmed.slice(1) : trimmed;
  const spaceIndex = withoutColon.search(/\s/);

  if (spaceIndex === -1) return "";

  return withoutColon.slice(spaceIndex + 1).trimStart();
}

export function parseGitExCommandArgs(input: string): Result<string[], GitExCommandParseError> {
  const args: string[] = [];
  let current = "";
  let quote: '"' | "'" | null = null;
  let tokenStarted = false;

  const push = () => {
    if (!tokenStarted) return;

    args.push(current);
    current = "";
    tokenStarted = false;
  };

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index]!;

    if (quote) {
      if (char === quote) {
        quote = null;
        tokenStarted = true;
        continue;
      }

      if (quote === '"' && char === "\\") {
        index += 1;
        if (index >= input.length) {
          current += "\\";
          tokenStarted = true;
          break;
        }

        current += input[index]!;
        tokenStarted = true;
        continue;
      }

      current += char;
      tokenStarted = true;
      continue;
    }

    if (/\s/.test(char)) {
      push();
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      tokenStarted = true;
      continue;
    }

    if (char === "\\") {
      index += 1;
      if (index >= input.length) {
        current += "\\";
        tokenStarted = true;
        break;
      }

      current += input[index]!;
      tokenStarted = true;
      continue;
    }

    if (DISALLOWED_UNQUOTED_TOKENS.has(char)) {
      return Result.err(
        new GitExCommandParseError({
          input,
          index,
          message: `Shell operator '${char}' is not supported in :git commands`,
        }),
      );
    }

    if (char === "&" && input[index + 1] === "&") {
      return Result.err(
        new GitExCommandParseError({
          input,
          index,
          message: "Shell operator '&&' is not supported in :git commands",
        }),
      );
    }

    if (char === "$" && input[index + 1] === "(") {
      return Result.err(
        new GitExCommandParseError({
          input,
          index,
          message: "Command substitution is not supported in :git commands",
        }),
      );
    }

    current += char;
    tokenStarted = true;
  }

  if (quote) {
    return Result.err(
      new GitExCommandParseError({
        input,
        index: input.length,
        message: `Unterminated ${quote === '"' ? "double" : "single"} quote`,
      }),
    );
  }

  push();

  if (args.length === 0) {
    return Result.err(
      new GitExCommandParseError({
        input,
        index: 0,
        message: "Expected git arguments after :git",
      }),
    );
  }

  return Result.ok(args);
}

export async function runGitExCommand(
  input: string,
  client: GitExCommandClient,
  options: GitExCommandRunOptions = {},
): Promise<Result<GitExCommandResult, GitExCommandError>> {
  const args = parseGitExCommandArgs(input);
  if (Result.isError(args)) return Result.err(args.error);

  const cwd = await client.getExecutorCwd();
  const output = await client.executor.run(args.value, {
    cwd,
    onStdout: (chunk) => options.onStdout?.(chunk.toString("utf-8")),
    onStderr: (chunk) => options.onStderr?.(chunk.toString("utf-8")),
  });
  if (Result.isError(output)) return Result.err(output.error);

  return Result.ok({
    input,
    args: args.value,
    output: output.value,
  });
}

export function isGitExCommandParseError(
  error: GitExCommandError,
): error is GitExCommandParseError {
  return error instanceof GitExCommandParseError;
}
