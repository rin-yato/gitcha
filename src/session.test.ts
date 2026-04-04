import type { GitRepoStatus, GitStatusFile } from "./git";
import { firstAvailableFile, sectionForIndex, stagedFileCount, visibleFiles } from "./session";
import { describe, expect, test } from "bun:test";

const file = (path: string, indexStatus = " ", workingTreeStatus = "M"): GitStatusFile => ({
  path,
  indexStatus: indexStatus as GitStatusFile["indexStatus"],
  workingTreeStatus: workingTreeStatus as GitStatusFile["workingTreeStatus"],
});

const makeStatus = (overrides?: Partial<GitRepoStatus>): GitRepoStatus => ({
  branch: "main",
  aheadCount: 0,
  behindCount: 0,
  files: { staged: [], changes: [], untracked: [], conflicted: [] },
  totalFiles: 0,
  isRepo: true,
  ...overrides,
});

describe("visibleFiles", () => {
  test("returns empty for null status", () => {
    expect(visibleFiles(null)).toEqual([]);
  });

  test("merges staged and changes", () => {
    const status = makeStatus({
      files: {
        staged: [file("a.ts", "A", " ")],
        changes: [file("b.ts", " ", "M")],
        untracked: [],
        conflicted: [],
      },
      totalFiles: 2,
    });
    expect(visibleFiles(status)).toHaveLength(2);
    expect(visibleFiles(status)[0]?.path).toBe("a.ts");
  });
});

describe("stagedFileCount", () => {
  test("returns zero for null", () => {
    expect(stagedFileCount(null)).toBe(0);
  });

  test("counts staged files", () => {
    expect(
      stagedFileCount(
        makeStatus({
          files: {
            staged: [file("x.ts", "A", " ")],
            changes: [],
            untracked: [],
            conflicted: [],
          },
        }),
      ),
    ).toBe(1);
  });
});

describe("sectionForIndex", () => {
  test("returns staged for indices below staged count", () => {
    expect(sectionForIndex(0, 2)).toBe("staged");
    expect(sectionForIndex(1, 2)).toBe("staged");
  });

  test("returns changes for indices at or above staged count", () => {
    expect(sectionForIndex(2, 2)).toBe("changes");
    expect(sectionForIndex(5, 2)).toBe("changes");
  });
});

describe("firstAvailableFile", () => {
  test("returns null for null status", () => {
    expect(firstAvailableFile(null)).toBeNull();
  });

  test("prefers staged files", () => {
    const status = makeStatus({
      files: {
        staged: [file("a.ts", "A", " ")],
        changes: [file("b.ts", " ", "M")],
        untracked: [],
        conflicted: [],
      },
    });
    expect(firstAvailableFile(status)).toEqual({ path: "a.ts", section: "staged" });
  });

  test("falls back to changes", () => {
    const status = makeStatus({
      files: {
        staged: [],
        changes: [file("b.ts", " ", "M")],
        untracked: [],
        conflicted: [],
      },
    });
    expect(firstAvailableFile(status)).toEqual({ path: "b.ts", section: "changes" });
  });

  test("returns null for empty repo", () => {
    expect(firstAvailableFile(makeStatus())).toBeNull();
  });
});
