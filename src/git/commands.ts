import { execFileSync } from "child_process";

import type { CompareTarget, GitFileStatus, GitStatusFile } from "./types";

/**
 * Execute a git command and return the output
 */
export function execGit(
  args: string[],
  options: { cwd?: string; encoding?: BufferEncoding; input?: string | Buffer } = {},
): string {
  const { cwd = process.cwd(), encoding = "utf-8", input } = options;

  try {
    const result = execFileSync("git", args, {
      cwd,
      encoding,
      input,
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diffs
    });
    return result || "";
  } catch (error) {
    if (error instanceof Error) {
      const execError = error as Error & {
        stderr?: string;
        stdout?: string;
        status?: number;
      };

      if (execError.status === 1 && execError.stdout) {
        return execError.stdout;
      }

      // Status 1 often means no changes, not a real error
      if (execError.status === 1 && !execError.stderr) {
        return "";
      }
      throw new Error(`Git command failed: ${execError.message}`);
    }
    throw error;
  }
}

/**
 * Check if current directory is a git repository
 */
export function isGitRepo(cwd?: string): boolean {
  try {
    execGit(["rev-parse", "--git-dir"], { cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the repository root path
 */
export function getRepoRoot(cwd?: string): string {
  return execGit(["rev-parse", "--show-toplevel"], { cwd }).trim();
}

/**
 * Stage a file
 */
export function stageFile(filePath: string, cwd?: string): void {
  execGit(["add", "--", filePath], { cwd });
}

/**
 * Unstage a file
 */
export function unstageFile(filePath: string, cwd?: string): void {
  execGit(["reset", "HEAD", "--", filePath], { cwd });
}

/**
 * Discard changes in a file (destructive!)
 */
export function discardChanges(filePath: string, cwd?: string): void {
  try {
    execGit(["checkout", "--", filePath], { cwd });
  } catch {
    // Untracked files are removed instead of restored.
    execGit(["clean", "-f", "--", filePath], { cwd });
  }
}

/**
 * Get diff for a file
 */
export function getFileDiff(
  filePath: string,
  options: { staged?: boolean; untracked?: boolean; cwd?: string } = {},
): string {
  const { staged = false, untracked = false, cwd } = options;
  const args = untracked
    ? ["diff", "--no-index", "--", "/dev/null", filePath]
    : staged
      ? ["diff", "--staged", "--", filePath]
      : ["diff", "--", filePath];
  return execGit(args, { cwd });
}

/**
 * Get full file diff with lots of context (for showing whole file with changes highlighted)
 */
export function getFileDiffWithContext(
  filePath: string,
  options: { staged?: boolean; baseRef?: string; cwd?: string } = {},
): string {
  const { staged = false, baseRef, cwd } = options;
  const args = baseRef
    ? ["diff", `-U500`, `${baseRef}...HEAD`, "--", filePath]
    : staged
      ? ["diff", "--staged", "-U500", "--", filePath]
      : ["diff", "-U500", "--", filePath];
  return execGit(args, { cwd });
}

/**
 * Get diff for unstaged changes against staged (what was already staged)
 */
export function getUnstagedDiff(filePath: string, cwd?: string): string {
  return execGit(["diff", "--", filePath], { cwd });
}

/**
 * Commit staged changes with a message
 */
export function commitChanges(message: string, cwd?: string): void {
  execGit(["commit", "--file", "-"], { cwd, input: `${message.trim()}\n` });
}

/**
 * Push current branch to its upstream
 */
export function pushChanges(cwd?: string): void {
  execGit(["push"], { cwd });
}

/**
 * Pull latest changes from upstream
 */
export function pullChanges(cwd?: string): void {
  execGit(["pull", "--ff-only"], { cwd });
}

/**
 * Get recent commit log lines
 */
export function getRecentCommits(limit = 12, cwd?: string): string[] {
  const output = execGit(["log", "--oneline", "--decorate", "-n", String(limit)], { cwd });
  return output.split(/\r?\n/).filter(Boolean);
}

/**
 * List local branch names
 */
export function getLocalBranches(cwd?: string): string[] {
  const output = execGit(["for-each-ref", "--format=%(refname:short)", "refs/heads/"], { cwd });
  return output.split(/\r?\n/).filter(Boolean).sort();
}

/**
 * Get the current branch name.
 */
export function getCurrentBranch(cwd?: string): string {
  return execGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd }).trim();
}

/**
 * Get the root commit for the current history.
 */
export function getRootCommit(cwd?: string): string | null {
  const output = execGit(["rev-list", "--max-parents=0", "HEAD"], { cwd }).trim();
  return output ? (output.split(/\r?\n/)[0] ?? null) : null;
}

function branchIsAncestorOfHead(branch: string, cwd?: string): boolean {
  try {
    execGit(["merge-base", "--is-ancestor", branch, "HEAD"], { cwd });
    return true;
  } catch {
    return false;
  }
}

function branchDistanceToHead(branch: string, cwd?: string): number {
  const output = execGit(["rev-list", "--count", `${branch}..HEAD`], { cwd }).trim();
  return Number(output) || Number.POSITIVE_INFINITY;
}

/**
 * Resolve the best default compare target for PR review mode.
 */
export function getDefaultCompareTarget(cwd?: string): CompareTarget | null {
  const currentBranch = getCurrentBranch(cwd);
  const branches = getLocalBranches(cwd).filter((branch) => branch !== currentBranch);

  if (branches.length === 0) {
    const rootCommit = getRootCommit(cwd);
    return rootCommit ? { ref: rootCommit, label: "root commit" } : null;
  }

  const ancestorBranches = branches.filter((branch) => branchIsAncestorOfHead(branch, cwd));
  if (ancestorBranches.length > 0) {
    const best = ancestorBranches.reduce<{ branch: string; distance: number } | null>(
      (currentBest, branch) => {
        const distance = branchDistanceToHead(branch, cwd);
        if (!currentBest || distance < currentBest.distance) {
          return { branch, distance };
        }
        return currentBest;
      },
      null,
    );

    if (best) {
      return { ref: best.branch, label: best.branch };
    }
  }

  const rootCommit = getRootCommit(cwd);
  if (rootCommit) {
    return { ref: rootCommit, label: "root commit" };
  }

  return { ref: branches[0]!, label: branches[0]! };
}

/**
 * Parse "XY path" or "XY\0path" lines from git diff --name-status
 */
function parseDiffNameStatusLine(line: string): { path: string; status: string } | null {
  if (!line || line.length < 3) return null;
  const indexStatus = line[0] ?? "";
  const workingTreeStatus = line[1] ?? "";
  const rest = line.slice(2).trimStart();

  if (!rest) return null;

  // Handle renames: "R100\told -> new"
  if (indexStatus === "R" || indexStatus === "C") {
    const arrowIndex = rest.indexOf("\t");
    if (arrowIndex !== -1) {
      const afterTab = rest.slice(arrowIndex + 1);
      const arrow = afterTab.indexOf(" -> ");
      if (arrow !== -1) {
        return { path: afterTab.slice(arrow + 4), status: workingTreeStatus || " " };
      }
    }
  }

  // Strip leading tab from name-status output
  const path = rest.startsWith("\t") ? rest.slice(1) : rest;
  return { path, status: workingTreeStatus || indexStatus || " " };
}

/**
 * Get list of changed files between a base branch and HEAD
 */
export function getBranchDiffFiles(baseBranch: string, cwd?: string): GitStatusFile[] {
  const output = execGit(["diff", "--name-status", `${baseBranch}...HEAD`], { cwd });

  if (!output) return [];

  const files: GitStatusFile[] = [];
  const lines = output.split(/\r?\n/).filter(Boolean);

  for (const line of lines) {
    const parsed = parseDiffNameStatusLine(line);
    if (parsed) {
      files.push({
        path: parsed.path,
        indexStatus: " " as GitFileStatus,
        workingTreeStatus: parsed.status as GitFileStatus,
      });
    }
  }

  return files;
}

/**
 * Get diff for a single file against a base branch
 */
export function getBranchFileDiff(filePath: string, baseBranch: string, cwd?: string): string {
  return execGit(["diff", "-U500", `${baseBranch}...HEAD`, "--", filePath], { cwd });
}
