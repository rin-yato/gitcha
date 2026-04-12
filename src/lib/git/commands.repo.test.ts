import { describe, expect, test } from "bun:test";

import { mkdtempSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  execGit,
  getBranchDiffFiles,
  getCompareTarget,
  getCurrentBranch,
  getLocalBranches,
  getRootCommit,
} from "./commands";

async function createRepo() {
  const dir = mkdtempSync(join(tmpdir(), "changes-git-"));
  await execGit(["init", "-b", "master"], { cwd: dir });
  await execGit(["config", "user.email", "test@example.com"], { cwd: dir });
  await execGit(["config", "user.name", "Test User"], { cwd: dir });

  writeFileSync(join(dir, "file.txt"), "master\n");
  await execGit(["add", "file.txt"], { cwd: dir });
  await execGit(["commit", "-m", "master commit"], { cwd: dir });

  await execGit(["checkout", "-b", "feat/a"], { cwd: dir });
  writeFileSync(join(dir, "file.txt"), "feat a\n");
  await execGit(["commit", "-am", "feat a commit"], { cwd: dir });

  await execGit(["checkout", "-b", "feat/b"], { cwd: dir });
  writeFileSync(join(dir, "file.txt"), "feat b\n");
  await execGit(["commit", "-am", "feat b commit"], { cwd: dir });

  return dir;
}

describe("default compare target", () => {
  test("prefers the parent branch for the current branch", async () => {
    const repo = await createRepo();
    const target = await getCompareTarget(repo);
    expect(target).toEqual({ ref: "feat/a", label: "feat/a" });
  });

  test("detects current branch correctly", async () => {
    const repo = await createRepo();
    expect(await getCurrentBranch(repo)).toBe("feat/b");
  });

  test("lists local branches", async () => {
    const repo = await createRepo();
    expect(await getLocalBranches(repo)).toEqual(["feat/a", "feat/b", "master"]);
  });

  test("returns diff files against the detected parent branch", async () => {
    const repo = await createRepo();
    const files = await getBranchDiffFiles("feat/a", repo);
    expect(files.map((file) => file.path)).toEqual(["file.txt"]);
  });

  test("preserves originalPath for renamed files", async () => {
    const repo = mkdtempSync(join(tmpdir(), "changes-rename-"));
    await execGit(["init", "-b", "master"], { cwd: repo });
    await execGit(["config", "user.email", "test@example.com"], { cwd: repo });
    await execGit(["config", "user.name", "Test User"], { cwd: repo });

    writeFileSync(join(repo, "old.txt"), "old\n");
    await execGit(["add", "old.txt"], { cwd: repo });
    await execGit(["commit", "-m", "base commit"], { cwd: repo });

    await execGit(["mv", "old.txt", "new.txt"], { cwd: repo });
    await execGit(["commit", "-am", "rename file"], { cwd: repo });
    expect(await getBranchDiffFiles("master", repo)).toEqual([]);
  });
});

describe("root fallback", () => {
  test("returns the first commit when there are no other local branches", async () => {
    const repo = mkdtempSync(join(tmpdir(), "changes-root-"));
    await execGit(["init", "-b", "master"], { cwd: repo });
    await execGit(["config", "user.email", "test@example.com"], { cwd: repo });
    await execGit(["config", "user.name", "Test User"], { cwd: repo });

    writeFileSync(join(repo, "file.txt"), "master\n");
    await execGit(["add", "file.txt"], { cwd: repo });
    await execGit(["commit", "-m", "root commit"], { cwd: repo });

    const rootCommit = await getRootCommit(repo);
    expect(rootCommit).not.toBeNull();
    expect(await getCompareTarget(repo)).toEqual({
      ref: rootCommit ?? "",
      label: "root commit",
    });
  });
});
