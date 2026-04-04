import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  execGit,
  getBranchDiffFiles,
  getBranchFileDiff,
  getCurrentBranch,
  getDefaultCompareTarget,
  getLocalBranches,
  getRootCommit,
} from "./commands";
import { describe, expect, test } from "bun:test";

function createRepo() {
  const dir = mkdtempSync(join(tmpdir(), "sourcery-git-"));
  execGit(["init", "-b", "master"], { cwd: dir });
  execGit(["config", "user.email", "test@example.com"], { cwd: dir });
  execGit(["config", "user.name", "Test User"], { cwd: dir });

  writeFileSync(join(dir, "file.txt"), "master\n");
  execGit(["add", "file.txt"], { cwd: dir });
  execGit(["commit", "-m", "master commit"], { cwd: dir });

  execGit(["checkout", "-b", "feat/a"], { cwd: dir });
  writeFileSync(join(dir, "file.txt"), "feat a\n");
  execGit(["commit", "-am", "feat a commit"], { cwd: dir });

  execGit(["checkout", "-b", "feat/b"], { cwd: dir });
  writeFileSync(join(dir, "file.txt"), "feat b\n");
  execGit(["commit", "-am", "feat b commit"], { cwd: dir });

  return dir;
}

describe("default compare target", () => {
  test("prefers the parent branch for the current branch", () => {
    const repo = createRepo();
    const target = getDefaultCompareTarget(repo);
    expect(target).toEqual({ ref: "feat/a", label: "feat/a" });
  });

  test("detects current branch correctly", () => {
    const repo = createRepo();
    expect(getCurrentBranch(repo)).toBe("feat/b");
  });

  test("lists local branches", () => {
    const repo = createRepo();
    expect(getLocalBranches(repo)).toEqual(["feat/a", "feat/b", "master"]);
  });

  test("returns diff files against the detected parent branch", () => {
    const repo = createRepo();
    const files = getBranchDiffFiles("feat/a", repo);
    expect(files.map((file) => file.path)).toEqual(["file.txt"]);
  });

  test("returns file diff against the detected parent branch", () => {
    const repo = createRepo();
    const diff = getBranchFileDiff("file.txt", "feat/a", repo);
    expect(diff).toContain("feat b");
    expect(diff).toContain("feat a");
  });
});

describe("root fallback", () => {
  test("returns the first commit when there are no other local branches", () => {
    const repo = mkdtempSync(join(tmpdir(), "sourcery-root-"));
    execGit(["init", "-b", "master"], { cwd: repo });
    execGit(["config", "user.email", "test@example.com"], { cwd: repo });
    execGit(["config", "user.name", "Test User"], { cwd: repo });

    writeFileSync(join(repo, "file.txt"), "master\n");
    execGit(["add", "file.txt"], { cwd: repo });
    execGit(["commit", "-m", "root commit"], { cwd: repo });

    const rootCommit = getRootCommit(repo);
    expect(rootCommit).not.toBeNull();
    expect(getDefaultCompareTarget(repo)).toEqual({
      ref: rootCommit ?? "",
      label: "root commit",
    });
  });
});
