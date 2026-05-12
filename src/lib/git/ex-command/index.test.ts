import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import type { GitCommandOutput } from "../types";
import {
  type GitExCommandClient,
  GitExCommandParseError,
  getGitExCommandInput,
  parseGitExCommandArgs,
  runGitExCommand,
} from ".";

function unwrapParse(input: string): string[] {
  const result = parseGitExCommandArgs(input);
  if (Result.isError(result)) throw result.error;
  return result.value;
}

function output(args: readonly string[], cwd: string): GitCommandOutput {
  return {
    args,
    cwd,
    exitCode: 0,
    signal: null,
    stdout: Buffer.from("ok"),
    stderr: Buffer.from(""),
    stdoutText: "ok",
    stderrText: "",
    durationMs: 12,
  };
}

describe("git ex command parsing", () => {
  test("extracts git command input from raw ex input", () => {
    expect(getGitExCommandInput(':git commit -m "example commit"')).toBe(
      'commit -m "example commit"',
    );
    expect(getGitExCommandInput("git add .")).toBe("add .");
  });

  test("parses quoted git arguments", () => {
    expect(unwrapParse('commit -m "example commit"')).toEqual([
      "commit",
      "-m",
      "example commit",
    ]);
    expect(unwrapParse("add 'file with spaces.ts'")).toEqual(["add", "file with spaces.ts"]);
  });

  test("parses escaped characters", () => {
    expect(unwrapParse('commit -m "quote \\"inside\\""')).toEqual([
      "commit",
      "-m",
      'quote "inside"',
    ]);
    expect(unwrapParse("add file\\ name.ts")).toEqual(["add", "file name.ts"]);
  });

  test("rejects empty input", () => {
    const result = parseGitExCommandArgs("   ");

    expect(Result.isError(result)).toBe(true);
    if (Result.isError(result)) expect(result.error).toBeInstanceOf(GitExCommandParseError);
  });

  test("rejects unterminated quotes", () => {
    const result = parseGitExCommandArgs('commit -m "example');

    expect(Result.isError(result)).toBe(true);
    if (Result.isError(result))
      expect(result.error.message).toContain("Unterminated double quote");
  });

  test("rejects shell operators outside quotes", () => {
    const result = parseGitExCommandArgs("status && rm -rf .");

    expect(Result.isError(result)).toBe(true);
    if (Result.isError(result)) expect(result.error.message).toContain("&&");
  });

  test("runs parsed args through the git executor", async () => {
    const calls: Array<{ args: readonly string[]; cwd?: string }> = [];
    const client: GitExCommandClient = {
      getExecutorCwd: async () => "/repo",
      executor: {
        run: async (args, options) => {
          calls.push({ args, cwd: options?.cwd });
          return Result.ok(output(args, options?.cwd ?? ""));
        },
      },
    };

    const result = await runGitExCommand('commit -m "example commit"', client);

    expect(Result.isOk(result)).toBe(true);
    expect(calls).toEqual([{ args: ["commit", "-m", "example commit"], cwd: "/repo" }]);
  });

  test("streams stdout and stderr chunks", async () => {
    const chunks: string[] = [];
    const client: GitExCommandClient = {
      getExecutorCwd: async () => "/repo",
      executor: {
        run: async (args, options) => {
          options?.onStdout?.(Buffer.from("out"));
          options?.onStderr?.(Buffer.from("err"));
          return Result.ok(output(args, options?.cwd ?? ""));
        },
      },
    };

    await runGitExCommand("status", client, {
      onStdout: (text) => chunks.push(`stdout:${text}`),
      onStderr: (text) => chunks.push(`stderr:${text}`),
    });

    expect(chunks).toEqual(["stdout:out", "stderr:err"]);
  });
});
