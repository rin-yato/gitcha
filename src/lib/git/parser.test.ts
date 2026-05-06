import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { gitStatusParser } from "./parser";

describe("git status parser", () => {
  test("parses status lines and categorizes files", () => {
    const parsed = gitStatusParser.parseRepoStatusLines([
      "## feat/a...origin/feat/a [ahead 2, behind 1]",
      "A  src/new.ts",
      " M src/app.ts",
      "?? untracked.ts",
      "UU conflicted.ts",
    ]);

    expect(Result.isOk(parsed)).toBe(true);
    if (Result.isError(parsed)) return;

    expect(parsed.value).toEqual({
      branch: "feat/a",
      upstream: "origin/feat/a",
      aheadCount: 2,
      behindCount: 1,
      files: [
        { path: "src/new.ts", indexStatus: "A", workingTreeStatus: " " },
        { path: "src/app.ts", indexStatus: " ", workingTreeStatus: "M" },
        { path: "untracked.ts", indexStatus: "?", workingTreeStatus: "?" },
        { path: "conflicted.ts", indexStatus: "U", workingTreeStatus: "U" },
      ],
    });

    expect(gitStatusParser.toRepoStatus(parsed.value).files).toEqual({
      staged: [{ path: "src/new.ts", indexStatus: "A", workingTreeStatus: " " }],
      changes: [{ path: "src/app.ts", indexStatus: " ", workingTreeStatus: "M" }],
      untracked: [{ path: "untracked.ts", indexStatus: "?", workingTreeStatus: "?" }],
      conflicted: [{ path: "conflicted.ts", indexStatus: "U", workingTreeStatus: "U" }],
    });
  });

  test("parses renamed files", () => {
    expect(gitStatusParser.parseStatusLine("R  old.txt -> new.txt")).toEqual({
      path: "new.txt",
      originalPath: "old.txt",
      indexStatus: "R",
      workingTreeStatus: " ",
    });
  });

  test("builds a stable file tree", () => {
    const tree = gitStatusParser.buildFileTree([
      { path: "src/z.ts", indexStatus: " ", workingTreeStatus: "M" },
      { path: "src/a.ts", indexStatus: " ", workingTreeStatus: "M" },
      { path: "README.md", indexStatus: " ", workingTreeStatus: "M" },
    ]);

    expect(tree.children.map((node) => node.name)).toEqual(["src", "README.md"]);
    expect(tree.children[0]?.children.map((node) => node.name)).toEqual(["a.ts", "z.ts"]);
  });
});
