import { buildFileTree, categorizeFiles, parseStatusLine } from "./parser";
import type { GitStatusFile } from "./types";
import { describe, expect, test } from "bun:test";

describe("parseStatusLine", () => {
  test("parses a modified file", () => {
    expect(parseStatusLine(" M src/app.ts")).toEqual({
      path: "src/app.ts",
      indexStatus: " ",
      workingTreeStatus: "M",
    });
  });

  test("parses a rename", () => {
    expect(parseStatusLine("R  old.txt -> new.txt")).toEqual({
      path: "new.txt",
      originalPath: "old.txt",
      indexStatus: "R",
      workingTreeStatus: " ",
    });
  });
});

describe("categorizeFiles", () => {
  test("splits files into status buckets", () => {
    const staged: GitStatusFile = {
      path: "staged.ts",
      indexStatus: "A",
      workingTreeStatus: " ",
    };
    const changed: GitStatusFile = {
      path: "changes.ts",
      indexStatus: " ",
      workingTreeStatus: "M",
    };
    const untracked: GitStatusFile = {
      path: "new.ts",
      indexStatus: "?",
      workingTreeStatus: "?",
    };
    const conflicted: GitStatusFile = {
      path: "conflict.ts",
      indexStatus: "U",
      workingTreeStatus: "U",
    };
    const files: GitStatusFile[] = [staged, changed, untracked, conflicted];

    expect(categorizeFiles(files)).toEqual({
      staged: [staged],
      changes: [changed],
      untracked: [untracked],
      conflicted: [conflicted],
    });
  });
});

describe("buildFileTree", () => {
  test("groups files by directory and sorts them", () => {
    const root = buildFileTree([
      { path: "src/z.ts", indexStatus: " ", workingTreeStatus: "M" },
      { path: "src/a.ts", indexStatus: " ", workingTreeStatus: "M" },
      { path: "README.md", indexStatus: " ", workingTreeStatus: "M" },
    ]);

    expect(root.children.map((node) => node.name)).toEqual(["src", "README.md"]);
    expect(root.children[0]?.children.map((node) => node.name)).toEqual(["a.ts", "z.ts"]);
  });
});
