import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { BRANCH_LIST_FORMAT } from "./branch";
import { COMMIT_LOG_FORMAT } from "./commit";
import { GitInvalidArgumentError } from "./errors";
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

function commitRecord(
  fields: {
    ref?: string;
    shortRef?: string;
    title?: string;
    description?: string;
    authorName?: string;
    authorEmail?: string;
    authoredAt?: string;
    committedAt?: string;
    parentRefs?: string;
    decorations?: string;
  } = {},
): string {
  return [
    `\x1e${fields.ref ?? "commitsha"}`,
    fields.shortRef ?? "commits",
    fields.title ?? "feat: add commits",
    fields.description ?? "Commit body",
    fields.authorName ?? "Ada",
    fields.authorEmail ?? "ada@example.com",
    fields.authoredAt ?? "2026-05-01T10:00:00Z",
    fields.committedAt ?? "2026-05-01T10:01:00Z",
    fields.parentRefs ?? "parentsha",
    fields.decorations ?? "HEAD -> main",
  ].join("\0");
}

function branchRecord(fields: {
  ref: string;
  name: string;
  commitRef: string;
  upstream?: string;
  current?: boolean;
  committedAt?: string;
  title?: string;
  authorName?: string;
  authorEmail?: string;
}): string {
  return [
    `\x1e${fields.ref}`,
    fields.name,
    fields.commitRef,
    fields.upstream ?? "",
    fields.current ? "*" : "",
    fields.committedAt ?? "2026-05-01T10:00:00Z",
    fields.title ?? "feat: branch",
    fields.authorName ?? "Ada",
    fields.authorEmail ?? "<ada@example.com>",
  ].join("\0");
}

describe("Git#diff.get", () => {
  test("runs diff from the repo root when cwd is nested", async () => {
    const { calls, executor } = createExecutor((args) =>
      args[0] === "rev-parse" ? "/repo\n" : "diff",
    );
    const git = new Git({ cwd: "/repo/packages/app", executor });

    await git.diff.get({
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

    await git.diff.get({ path: "src/file.ts", indexStatus: "M", workingTreeStatus: " " });
    await git.diff.get({
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

    await git.diff.get({ path: "src/file.ts", indexStatus: "A", workingTreeStatus: " " });

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

    await git.diff.get({ path: "src/file.ts", indexStatus: " ", workingTreeStatus: "M" });

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

    await git.diff.get({
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

    await git.diff.get({
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

    await git.diff.get({ path: "src/file.ts", indexStatus: "?", workingTreeStatus: "?" });

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

describe("Git branch APIs", () => {
  test("lists local and remote branches", async () => {
    const { calls, executor } = createExecutor((args) => {
      if (args[0] === "rev-parse") return "/repo\n";
      if (args[0] === "for-each-ref") {
        return [
          branchRecord({
            ref: "refs/heads/main",
            name: "main",
            commitRef: "mainsha",
            upstream: "origin/main",
            current: true,
          }),
          branchRecord({
            ref: "refs/remotes/origin/feature",
            name: "origin/feature",
            commitRef: "featuresha",
            title: "feat: remote",
          }),
        ].join("");
      }
      return "";
    });
    const git = new Git({ executor });

    const result = await git.branch.list();

    expect(Result.isOk(result)).toBe(true);
    if (Result.isError(result)) return;

    expect(result.value).toMatchObject([
      { name: "main", scope: "local", current: true, upstream: "origin/main" },
      { name: "origin/feature", scope: "remote", current: false },
    ]);
    expect(calls[1]?.args).toEqual([
      "for-each-ref",
      `--format=${BRANCH_LIST_FORMAT}`,
      "refs/heads",
      "refs/remotes",
    ]);
  });

  test("lists only remote branches when requested", async () => {
    const { calls, executor } = createExecutor((args) => {
      if (args[0] === "rev-parse") return "/repo\n";
      if (args[0] === "for-each-ref") return "";
      return "";
    });
    const git = new Git({ executor });

    const result = await git.branch.list({ scope: "remote" });

    expect(Result.isOk(result)).toBe(true);
    expect(calls[1]?.args).toEqual([
      "for-each-ref",
      `--format=${BRANCH_LIST_FORMAT}`,
      "refs/remotes",
    ]);
  });
});

describe("Git commit APIs", () => {
  test("queries commits with filters and parses rich commit data", async () => {
    const { calls, executor } = createExecutor((args) => {
      if (args[0] === "rev-parse") return "/repo\n";
      if (args[0] === "log") return commitRecord();
      return "";
    });
    const git = new Git({ cwd: "/repo/packages/app", executor });

    const result = await git.commit.list({
      all: true,
      limit: 5,
      skip: 2,
      search: "fix bug",
      refs: ["main"],
      path: "src/file.ts",
      author: "Ada",
      since: "2026-01-01",
      until: "2026-02-01",
    });

    expect(Result.isOk(result)).toBe(true);
    if (Result.isError(result)) return;

    expect(result.value[0]).toMatchObject({
      ref: "commitsha",
      shortRef: "commits",
      title: "feat: add commits",
      description: "Commit body",
      message: "feat: add commits\n\nCommit body",
      parentRefs: ["parentsha"],
      origin: "main",
    });
    expect(calls[1]?.options).toMatchObject({ cwd: "/repo", dedupe: true });
    expect(calls[1]?.args).toEqual([
      "log",
      `--format=${COMMIT_LOG_FORMAT}`,
      "--decorate=short",
      "--all",
      "--max-count=5",
      "--skip=2",
      "--author=Ada",
      "--since=2026-01-01",
      "--until=2026-02-01",
      "--regexp-ignore-case",
      "--grep=fix bug",
      "main",
      "--",
      "src/file.ts",
    ]);
  });

  test("commit.search rejects empty search", async () => {
    const { executor } = createExecutor();
    const git = new Git({ executor });

    const result = await git.commit.search("   ");

    expect(Result.isError(result)).toBe(true);
    if (Result.isError(result)) expect(result.error).toBeInstanceOf(GitInvalidArgumentError);
  });

  test("commit.get rejects option-like refs", async () => {
    const { executor } = createExecutor();
    const git = new Git({ executor });

    const result = await git.commit.get("--all");

    expect(Result.isError(result)).toBe(true);
    if (Result.isError(result)) expect(result.error).toBeInstanceOf(GitInvalidArgumentError);
  });

  test("commit.get returns a repository state error when no commit is found", async () => {
    const { executor } = createExecutor((args) => {
      if (args[0] === "rev-parse") return "/repo\n";
      if (args[0] === "log") return "";
      return "";
    });
    const git = new Git({ executor });

    const result = await git.commit.get("missing");

    expect(Result.isError(result)).toBe(true);
    if (Result.isError(result)) expect(result.error.message).toContain("Commit not found");
  });
});

describe("Git commit review APIs", () => {
  test("builds status for a single commit against its first parent", async () => {
    const { calls, executor } = createExecutor((args) => {
      if (args[0] === "rev-parse") return "/repo\n";
      if (args[0] === "rev-list") return "commitsha parentsha otherparent\n";
      if (args[0] === "diff") return "M\0src/app.ts\0R100\0src/old.ts\0src/new.ts\0";
      return "";
    });
    const git = new Git({ executor });

    const result = await git.review.status({ mode: "single-commit", ref: "feature" });

    expect(Result.isOk(result)).toBe(true);
    if (Result.isError(result)) return;

    expect(result.value.resolution).toMatchObject({
      mode: "single-commit",
      baseRef: "parentsha",
      compareRef: "commitsha",
      targetRef: "commitsha",
      revisionRange: "parentsha..commitsha",
      isRootCommit: false,
    });
    expect(result.value.files.changes).toEqual([
      { path: "src/app.ts", indexStatus: " ", workingTreeStatus: "M" },
      {
        path: "src/new.ts",
        originalPath: "src/old.ts",
        indexStatus: " ",
        workingTreeStatus: "R",
      },
    ]);
    expect(calls[1]?.args).toEqual(["rev-list", "--parents", "-n", "1", "feature"]);
    expect(calls[2]?.args).toEqual([
      "diff",
      "--name-status",
      "-z",
      "-M",
      "parentsha",
      "commitsha",
      "--",
    ]);
  });

  test("uses git show for a root single-commit patch", async () => {
    const { calls, executor } = createExecutor((args) => {
      if (args[0] === "rev-parse") return "/repo\n";
      if (args[0] === "rev-list") return "rootsha\n";
      if (args[0] === "show") return "patch";
      return "";
    });
    const git = new Git({ executor });

    const result = await git.review.diff(
      { mode: "single-commit", ref: "root" },
      { path: "README.md", indexStatus: " ", workingTreeStatus: "A" },
    );

    expect(Result.isOk(result)).toBe(true);
    expect(calls[2]?.args).toEqual([
      "show",
      "--format=",
      "--root",
      "--unified=999999999",
      "--no-ext-diff",
      "rootsha",
      "--",
      "README.md",
    ]);
  });

  test("builds base commit status against the working tree including untracked files", async () => {
    const { calls, executor } = createExecutor((args) => {
      if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return "/repo\n";
      if (args[0] === "rev-parse" && args[1] === "--verify") return "basesha\n";
      if (args[0] === "diff") return "M\0src/app.ts\0";
      if (args[0] === "ls-files") return "untracked.ts\0";
      return "";
    });
    const git = new Git({ executor });

    const result = await git.review.status({ mode: "base-commit", ref: "base" });

    expect(Result.isOk(result)).toBe(true);
    if (Result.isError(result)) return;

    expect(result.value.resolution).toMatchObject({
      mode: "base-commit",
      baseRef: "basesha",
      compareRef: null,
      targetRef: null,
      revisionRange: "basesha..WORKTREE",
      includeUntracked: true,
    });
    expect(result.value.files.changes).toEqual([
      { path: "src/app.ts", indexStatus: " ", workingTreeStatus: "M" },
    ]);
    expect(result.value.files.untracked).toEqual([
      { path: "untracked.ts", indexStatus: "?", workingTreeStatus: "?" },
    ]);
    expect(calls[2]?.args).toEqual(["diff", "--name-status", "-z", "-M", "basesha", "--"]);
    expect(calls[3]?.args).toEqual(["ls-files", "--others", "--exclude-standard", "-z"]);
  });

  test("builds base commit patch against an explicit compare ref", async () => {
    const { calls, executor } = createExecutor((args) => {
      if (args[0] === "rev-parse" && args[1] === "--show-toplevel") return "/repo\n";
      if (args[0] === "rev-parse" && args[2] === "base^{commit}") return "basesha\n";
      if (args[0] === "rev-parse" && args[2] === "HEAD^{commit}") return "headsha\n";
      if (args[0] === "diff") return "patch";
      return "";
    });
    const git = new Git({ executor });

    const result = await git.review.diff(
      { mode: "base-commit", ref: "base", compareRef: "HEAD" },
      { path: "src/app.ts", indexStatus: " ", workingTreeStatus: "M" },
    );

    expect(Result.isOk(result)).toBe(true);
    expect(calls[3]?.args).toEqual([
      "diff",
      "--unified=999999999",
      "--no-ext-diff",
      "-M",
      "basesha",
      "headsha",
      "--",
      "src/app.ts",
    ]);
  });
});
