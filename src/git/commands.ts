import type { CompareTarget, GitFileStatus, GitStatusFile } from "./types";
import { execFile, spawn } from "node:child_process";

/**
 * Execute a git command and return the output
 */
export async function execGit(
  args: string[],
  options: { cwd?: string; encoding?: BufferEncoding } = {},
): Promise<string> {
  const { cwd = process.cwd(), encoding = "utf-8" } = options;

  return new Promise((resolve, reject) => {
    execFile("git", args, { cwd, encoding, maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        const execError = error as Error & {
          stderr?: string;
          stdout?: string;
          status?: number;
        };

        if (execError.status === 1 && execError.stdout) {
          resolve(execError.stdout);
          return;
        }

        if (execError.status === 1 && !execError.stderr) {
          resolve("");
          return;
        }
        reject(new Error(`Git command failed: ${execError.message}`));
        return;
      }
      resolve(stdout || "");
    });
  });
}

/**
 * Execute a git command with stdin input
 */
export async function execGitWithInput(
  args: string[],
  input: string,
  cwd?: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, {
      cwd: cwd ?? process.cwd(),
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });
    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve(stdout || "");
      } else if (code === 1 && stdout) {
        resolve(stdout);
      } else if (code === 1 && !stderr) {
        resolve("");
      } else {
        reject(new Error(`Git command failed: ${stderr || `exit code ${code}`}`));
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Git command failed: ${err.message}`));
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}

/**
 * Check if current directory is a git repository
 */
export async function isGitRepo(cwd?: string): Promise<boolean> {
  try {
    await execGit(["rev-parse", "--git-dir"], { cwd });
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the repository root path
 */
export async function getRepoRoot(cwd?: string): Promise<string> {
  return (await execGit(["rev-parse", "--show-toplevel"], { cwd })).trim();
}

/**
 * Stage a file
 */
export async function stageFile(filePath: string, cwd?: string): Promise<void> {
  await execGit(["add", "--", filePath], { cwd });
}

/**
 * Unstage a file
 */
export async function unstageFile(filePath: string, cwd?: string): Promise<void> {
  await execGit(["reset", "HEAD", "--", filePath], { cwd });
}

/**
 * Discard changes in a file (destructive!)
 */
export async function discardChanges(filePath: string, cwd?: string): Promise<void> {
  try {
    await execGit(["checkout", "--", filePath], { cwd });
  } catch {
    await execGit(["clean", "-f", "--", filePath], { cwd });
  }
}

/**
 * Commit staged changes with a message
 */
export async function commitChanges(message: string, cwd?: string): Promise<void> {
  await execGitWithInput(["commit", "--file", "-"], `${message.trim()}\n`, cwd);
}

/**
 * Push current branch to its upstream
 */
export async function pushChanges(cwd?: string): Promise<void> {
  await execGit(["push"], { cwd });
}

/**
 * Pull latest changes from upstream
 */
export async function pullChanges(cwd?: string): Promise<void> {
  await execGit(["pull", "--ff-only"], { cwd });
}

/**
 * Get file content at a specific git ref.
 * Returns null if the file doesn't exist at that ref.
 */
export async function getFileVersion(
  ref: string,
  filePath: string,
  cwd?: string,
): Promise<string | null> {
  try {
    const output = await execGit(["show", `${ref}:${filePath}`], { cwd });
    return output;
  } catch {
    return null;
  }
}

/**
 * Get merge-base between a base ref and HEAD.
 * Returns the merge-base ref, or falls back to baseRef if merge-base fails.
 */
export async function getMergeBase(baseRef: string, cwd?: string): Promise<string> {
  try {
    const output = await execGit(["merge-base", baseRef, "HEAD"], { cwd });
    return output.trim();
  } catch {
    return baseRef;
  }
}

/**
 * Get the current branch name.
 */
export async function getCurrentBranch(cwd?: string): Promise<string> {
  return (await execGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd })).trim();
}

/**
 * Get the root commit for the current history.
 */
export async function getRootCommit(cwd?: string): Promise<string | null> {
  const output = (await execGit(["rev-list", "--max-parents=0", "HEAD"], { cwd })).trim();
  return output ? (output.split(/\r?\n/)[0] ?? null) : null;
}

/**
 * List local branch names.
 */
export async function getLocalBranches(cwd?: string): Promise<string[]> {
  const output = await execGit(["for-each-ref", "--format=%(refname:short)", "refs/heads/"], {
    cwd,
  });
  return output.split(/\r?\n/).filter(Boolean).sort();
}

/**
 * Get recent commit log lines.
 */
export async function getRecentCommits(limit = 12, cwd?: string): Promise<string[]> {
  const output = await execGit(["log", "--oneline", "--decorate", "-n", String(limit)], {
    cwd,
  });
  return output.split(/\r?\n/).filter(Boolean);
}

/**
 * Resolve the best default compare target for PR review mode.
 *
 * Uses `git for-each-ref --merged HEAD` to batch-fetch all ancestor branches
 * in a single call, then `git rev-list --count` to find the closest one.
 * Down from ~100 sequential calls to ~3 total.
 */
export async function getCompareTarget(cwd?: string): Promise<CompareTarget | null> {
  const currentBranch = await getCurrentBranch(cwd);

  // Get all branches merged into HEAD in one call
  const mergedOutput = await execGit(
    ["for-each-ref", "--format=%(refname:short)", "--merged", "HEAD", "refs/heads/"],
    { cwd },
  );
  const mergedBranches = mergedOutput
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((b) => b !== currentBranch)
    .sort();

  if (mergedBranches.length === 0) {
    const rootCommit = await getRootCommit(cwd);
    return rootCommit ? { ref: rootCommit, label: "root commit" } : null;
  }

  // Find the closest ancestor by computing distances in parallel
  const distanceResults = await Promise.all(
    mergedBranches.map(async (branch) => {
      const output = await execGit(["rev-list", "--count", `${branch}..HEAD`], { cwd });
      return { branch, distance: Number(output) || Number.POSITIVE_INFINITY };
    }),
  );

  const best = distanceResults.reduce<{ branch: string; distance: number } | null>(
    (currentBest, { branch, distance }) => {
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

  const rootCommit = await getRootCommit(cwd);
  if (rootCommit) {
    return { ref: rootCommit, label: "root commit" };
  }

  return { ref: mergedBranches[0]!, label: mergedBranches[0]! };
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
export async function getBranchDiffFiles(
  baseBranch: string,
  cwd?: string,
): Promise<GitStatusFile[]> {
  const output = await execGit(["diff", "--name-status", `${baseBranch}...HEAD`], { cwd });

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
