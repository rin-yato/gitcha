import { describe, expect, test } from "bun:test";

import { generateDiff } from "./diff";
import { buildFileTree, categorizeFiles, parseStatusLine } from "./parser";
import type { GitStatusFile } from "./types";

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

describe("parseStatusLine with status output", () => {
  test("parses a staged file line", () => {
    expect(parseStatusLine("A  src/new.ts")).toEqual({
      path: "src/new.ts",
      indexStatus: "A",
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

  test("preserves originalPath for renamed files in fileInfo", () => {
    const root = buildFileTree([
      {
        path: "src/new-name.ts",
        originalPath: "src/old-name.ts",
        indexStatus: "R",
        workingTreeStatus: " ",
      },
    ]);

    const fileNode = root.children[0]?.children[0];
    expect(fileNode?.name).toBe("new-name.ts");
    expect(fileNode?.path).toBe("src/new-name.ts");
    expect(fileNode?.fileInfo?.originalPath).toBe("src/old-name.ts");
    expect(fileNode?.fileInfo?.indexStatus).toBe("R");
  });

  test("handles deeply nested files", () => {
    const root = buildFileTree([
      { path: "a/b/c/d/nested.ts", indexStatus: "A", workingTreeStatus: " " },
    ]);

    expect(root.children[0]?.name).toBe("a");
    expect(root.children[0]?.children[0]?.name).toBe("b");
    expect(root.children[0]?.children[0]?.children[0]?.name).toBe("c");
    expect(root.children[0]?.children[0]?.children[0]?.children[0]?.name).toBe("d");
    expect(root.children[0]?.children[0]?.children[0]?.children[0]?.children[0]?.name).toBe(
      "nested.ts",
    );
  });

  test("handles root-level files without directory", () => {
    const root = buildFileTree([{ path: "root.ts", indexStatus: " ", workingTreeStatus: "M" }]);

    expect(root.children.length).toBe(1);
    expect(root.children[0]?.name).toBe("root.ts");
    expect(root.children[0]?.isDirectory).toBe(false);
    expect(root.children[0]?.fileInfo?.path).toBe("root.ts");
  });

  test("preserves originalPath in generated rename diffs", () => {
    const diff = generateDiff(
      {
        baseContent: "old\n",
        currentContent: "new\n",
        originalPath: "src/old-name.ts",
      },
      "src/new-name.ts",
    );

    expect(diff).toContain("--- src/old-name.ts");
    expect(diff).toContain("+++ src/new-name.ts");
  });

  test("duplicate paths only store first fileInfo (last one wins for path traversal)", () => {
    const root = buildFileTree([
      { path: "src/shared.ts", indexStatus: "A", workingTreeStatus: " " },
      { path: "src/shared.ts", indexStatus: " ", workingTreeStatus: "M" },
    ]);

    expect(root.children[0]?.children.length).toBe(1);
    expect(root.children[0]?.children[0]?.fileInfo?.indexStatus).toBe("A");
  });
});
