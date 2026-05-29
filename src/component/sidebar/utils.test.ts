import { describe, expect, test } from "bun:test";

import type { GitRepoStatus, GitStatusFile } from "@/lib/git/types";

import { collectSidebarFiles, createSidebarRows } from "./utils";
import { createSidebarDirectoryKey } from "@/context/sidebar";

function createStatus(files: GitStatusFile[]): GitRepoStatus {
  return {
    branch: "main",
    aheadCount: 0,
    behindCount: 0,
    isRepo: true,
    totalFiles: files.length,
    files: {
      staged: [],
      changes: files,
      untracked: [],
      conflicted: [],
    },
  };
}

describe("sidebar tree rows", () => {
  test("flattens single-child directory chains into grouped labels", () => {
    const files: GitStatusFile[] = [
      { path: "src/lib/util.ts", indexStatus: "M", workingTreeStatus: " " },
      { path: "src/lib/something.ts", indexStatus: "M", workingTreeStatus: " " },
    ];

    const rows = createSidebarRows(createStatus(files), "tree");

    expect(rows.map((row) => `${row.kind}:${row.path}`)).toEqual([
      "directory:src/lib",
      "file:src/lib/something.ts",
      "file:src/lib/util.ts",
    ]);

    expect(rows.map((row) => `${row.kind}:${row.name}`)).toEqual([
      "directory:src/lib",
      "file:something.ts",
      "file:util.ts",
    ]);
  });

  test("keeps full paths as flat row labels", () => {
    const files: GitStatusFile[] = [
      { path: "src/lib/util.ts", indexStatus: "M", workingTreeStatus: " " },
    ];

    const rows = createSidebarRows(createStatus(files), "flat");

    expect(rows.map((row) => `${row.kind}:${row.name}`)).toEqual(["file:src/lib/util.ts"]);
  });

  test("hides child rows under collapsed directories", () => {
    const files: GitStatusFile[] = [
      { path: "src/lib/util.ts", indexStatus: "M", workingTreeStatus: " " },
      { path: "src/lib/something.ts", indexStatus: "M", workingTreeStatus: " " },
    ];
    const status = createStatus(files);
    const collapsedKey = createSidebarDirectoryKey("changes", "src/lib");
    const rows = createSidebarRows(status, "tree", [collapsedKey]);

    expect(rows.map((row) => `${row.kind}:${row.path}`)).toEqual(["directory:src/lib"]);
    expect(rows[0]).toMatchObject({ kind: "directory", isCollapsed: true });
    expect(collectSidebarFiles(status, "tree").map((entry) => entry.target.path)).toEqual([
      "src/lib/something.ts",
      "src/lib/util.ts",
    ]);
  });
});
