import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { Git } from "./index";
import type { GitExecutorLike } from "./types";

function createExecutor(output = "diff") {
  const calls: Array<{ args: readonly string[]; options?: unknown }> = [];

  const executor: GitExecutorLike = {
    async run(): Promise<any> {
      throw new Error("not implemented");
    },
    async runText(args, options) {
      calls.push({ args, options });
      return Result.ok(output);
    },
  };

  return { calls, executor };
}

describe("Git#getUnifiedDiff", () => {
  test("uses cached diff for staged files", async () => {
    const { calls, executor } = createExecutor();
    const git = new Git({ executor });

    await git.getUnifiedDiff({ path: "src/file.ts", indexStatus: "A", workingTreeStatus: " " });

    expect(calls[0]?.args).toEqual([
      "diff",
      "--cached",
      "--unified=999999999",
      "--no-ext-diff",
      "--",
      "src/file.ts",
    ]);
  });

  test("uses working tree diff for modified files", async () => {
    const { calls, executor } = createExecutor();
    const git = new Git({ executor });

    await git.getUnifiedDiff({ path: "src/file.ts", indexStatus: " ", workingTreeStatus: "M" });

    expect(calls[0]?.args).toEqual([
      "diff",
      "--unified=999999999",
      "--no-ext-diff",
      "--",
      "src/file.ts",
    ]);
  });

  test("uses no-index diff for untracked files", async () => {
    const { calls, executor } = createExecutor();
    const git = new Git({ executor });

    await git.getUnifiedDiff({ path: "src/file.ts", indexStatus: "?", workingTreeStatus: "?" });

    expect(calls[0]?.args).toEqual([
      "diff",
      "--no-index",
      "--unified=999999999",
      "--no-ext-diff",
      "--",
      "/dev/null",
      "src/file.ts",
    ]);
  });
});
