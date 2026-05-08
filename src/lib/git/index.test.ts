import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { Git } from "./index";
import type { GitExecutorLike } from "./types";

function createExecutor(
  resolveText: (args: readonly string[], options?: unknown) => string = (args) =>
    args[0] === "rev-parse" ? "/repo" : "diff",
) {
  const calls: Array<{ args: readonly string[]; options?: unknown }> = [];

  const executor: GitExecutorLike = {
    async run(): Promise<any> {
      throw new Error("not implemented");
    },
    async runText(args, options) {
      calls.push({ args, options });
      return Result.ok(resolveText(args, options));
    },
  };

  return { calls, executor };
}

describe("Git#getUnifiedDiff", () => {
  test("runs diff from the repo root when cwd is nested", async () => {
    const { calls, executor } = createExecutor((args) =>
      args[0] === "rev-parse" ? "/repo\n" : "diff",
    );
    const git = new Git({ cwd: "/repo/packages/app", executor });

    await git.getUnifiedDiff({
      path: "frontend/src/file.ts",
      indexStatus: " ",
      workingTreeStatus: "M",
    });

    expect(calls[0]?.args).toEqual(["rev-parse", "--show-toplevel"]);
    expect(calls[1]?.options).toMatchObject({ cwd: "/repo" });
    expect(calls[1]?.args).toEqual([
      "diff",
      "--unified=999999999",
      "--no-ext-diff",
      "--",
      "frontend/src/file.ts",
    ]);
  });

  test("memoizes repo root across diff calls", async () => {
    const { calls, executor } = createExecutor((args) =>
      args[0] === "rev-parse" ? "/repo\n" : "diff",
    );
    const git = new Git({ cwd: "/repo/packages/app", executor });

    await git.getUnifiedDiff({ path: "src/file.ts", indexStatus: "M", workingTreeStatus: " " });
    await git.getUnifiedDiff({
      path: "src/other.ts",
      indexStatus: "M",
      workingTreeStatus: " ",
    });

    expect(calls.filter((call) => call.args[0] === "rev-parse")).toHaveLength(1);
  });

  test("memoizes repo context for detectRepoContext", async () => {
    const { calls, executor } = createExecutor((args) =>
      args[0] === "rev-parse" ? "/repo\n" : "diff",
    );
    const git = new Git({ cwd: "/repo/packages/app", executor });

    await git.getRepoContext();
    await git.getRepoContext();

    expect(calls.filter((call) => call.args[0] === "rev-parse")).toHaveLength(1);
  });

  test("uses cached diff for staged files", async () => {
    const { calls, executor } = createExecutor();
    const git = new Git({ executor });

    await git.getUnifiedDiff({ path: "src/file.ts", indexStatus: "A", workingTreeStatus: " " });

    expect(calls[0]?.args).toEqual(["rev-parse", "--show-toplevel"]);
    expect(calls[1]?.args).toEqual([
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

    expect(calls[0]?.args).toEqual(["rev-parse", "--show-toplevel"]);
    expect(calls[1]?.args).toEqual([
      "diff",
      "--unified=999999999",
      "--no-ext-diff",
      "--",
      "src/file.ts",
    ]);
  });

  test("uses cached diff for staged view of a partially staged file", async () => {
    const { calls, executor } = createExecutor();
    const git = new Git({ executor });

    await git.getUnifiedDiff({
      path: "src/file.ts",
      indexStatus: "M",
      workingTreeStatus: "M",
      section: "staged",
    });

    expect(calls[1]?.args).toEqual([
      "diff",
      "--cached",
      "--unified=999999999",
      "--no-ext-diff",
      "--",
      "src/file.ts",
    ]);
  });

  test("uses working tree diff for changes view of a partially staged file", async () => {
    const { calls, executor } = createExecutor();
    const git = new Git({ executor });

    await git.getUnifiedDiff({
      path: "src/file.ts",
      indexStatus: "M",
      workingTreeStatus: "M",
      section: "changes",
    });

    expect(calls[1]?.args).toEqual([
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

    expect(calls[0]?.args).toEqual(["rev-parse", "--show-toplevel"]);
    expect(calls[1]?.args).toEqual([
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
