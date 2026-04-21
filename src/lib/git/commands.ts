import type { CompareTarget, GitFileStatus, GitStatusFile } from "./types";
import { execFile, spawn } from "node:child_process";

const EMPTY_TREE_REF = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

export async function isBinaryDiff(
  filePath: string,
  section: "staged" | "changes" | "compare",
  baseRef?: string,
  targetRef?: string,
  cwd?: string,
): Promise<boolean> {
  try {
    const diffCmd =
      section === "staged"
        ? ["diff", "--numstat", "--cached", "--", filePath]
        : section === "changes"
          ? ["diff", "--numstat", "--", filePath]
          : baseRef && targetRef
            ? ["diff", "--numstat", `${baseRef}...${targetRef}`, "--", filePath]
            : baseRef
              ? ["diff", "--numstat", `${baseRef}...HEAD`, "--", filePath]
              : null;

    if (!diffCmd) return false;

    const output = await execGit(diffCmd, { cwd });
    const line = output.split(/\r?\n/).find((entry) => entry.length > 0);
    if (!line) return false;
    const parts = line.split("\t");
    return parts[0] === "-" && parts[1] === "-";
  } catch {
    return false;
  }
}

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
 * Get the first parent of a commit, if one exists.
 */
export async function getCommitParent(commitRef: string, cwd?: string): Promise<string | null> {
  const output = (
    await execGit(["rev-list", "--parents", "-n", "1", commitRef], { cwd })
  ).trim();
  const parts = output.split(/\r?\n/)[0]?.split(/\s+/) ?? [];
  return parts[1] ?? null;
}

/**
 * Get the upstream branch for the current branch, if one is configured.
 */
async function getCurrentBranchUpstream(cwd?: string): Promise<string | null> {
  try {
    return (
      await execGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], { cwd })
    ).trim();
  } catch {
    return null;
  }
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
 * List branches that can be used as compare targets.
 */
export async function getCompareBranches(cwd?: string): Promise<string[]> {
  const output = await execGit(
    ["for-each-ref", "--format=%(refname:short)", "refs/heads/", "refs/remotes/"],
    { cwd },
  );

  return [
    ...new Set(
      output
        .split(/\r?\n/)
        .filter(Boolean)
        .filter((branch) => !branch.endsWith("/HEAD")),
    ),
  ].sort();
}

/**
 * Search compare branches by query against all local and remote refs.
 */
export async function searchCompareBranches(query: string, cwd?: string): Promise<string[]> {
  const needle = query.trim().toLowerCase();
  const branches = await getCompareBranches(cwd);
  if (!needle) return branches;

  return branches.filter((branch) => branch.toLowerCase().includes(needle));
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
 * Get changed files between two refs.
 */
export async function getDiffFiles(
  baseRef: string,
  targetRef: string,
  cwd?: string,
): Promise<GitStatusFile[]> {
  const output = await execGit(["diff", "--name-status", baseRef, targetRef], { cwd });

  if (!output) return [];

  const files: GitStatusFile[] = [];
  for (const line of output.split(/\r?\n/).filter(Boolean)) {
    const parsed = parseDiffNameStatusLine(line);
    if (!parsed) continue;

    files.push({
      path: parsed.path,
      originalPath: parsed.originalPath,
      indexStatus: " " as GitFileStatus,
      workingTreeStatus: parsed.status as GitFileStatus,
    });
  }

  return files;
}

/**
 * Get changed files for a single commit against its first parent.
 */
export async function getCommitDiffFiles(
  commitRef: string,
  cwd?: string,
): Promise<GitStatusFile[]> {
  const parentRef = (await getCommitParent(commitRef, cwd)) ?? EMPTY_TREE_REF;
  return getDiffFiles(parentRef, commitRef, cwd);
}

/**
 * Get recent commits with stable refs and labels for selection UIs.
 */
export async function getRecentCommitSummaries(
  limit = 12,
  cwd?: string,
): Promise<Array<{ ref: string; shortRef: string; message: string; origin: string }>> {
  const output = await execGit(
    ["log", "--decorate=short", "--pretty=format:%H%x09%s%x09%D", "-n", String(limit)],
    {
      cwd,
    },
  );

  return output
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [ref, subject = "", decorations = ""] = line.split("\t");
      const branch =
        decorations
          .split(",")
          .map((entry) => entry.trim())
          .find(
            (entry) =>
              entry.length > 0 &&
              entry !== "HEAD" &&
              entry !== "tag:" &&
              !entry.startsWith("tag: "),
          )
          ?.replace(/^HEAD ->\s*/, "") ?? "";
      return {
        ref: ref ?? "",
        shortRef: (ref ?? "").slice(0, 7),
        message: subject.trim(),
        origin: branch,
      };
    })
    .filter((entry) => entry.ref.length > 0);
}

/**
 * Search commits by message, hash, or decoration across recent history.
 */
export async function searchCompareCommits(
  query: string,
  limit = 1000,
  cwd?: string,
): Promise<Array<{ ref: string; shortRef: string; message: string; origin: string }>> {
  const needle = query.trim().toLowerCase();
  const commits = await getRecentCommitSummaries(limit, cwd);

  if (!needle) return commits;

  return commits.filter((commit) => {
    const haystack =
      `${commit.ref} ${commit.shortRef} ${commit.message} ${commit.origin}`.toLowerCase();
    return haystack.includes(needle);
  });
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

  const upstreamBranch = await getCurrentBranchUpstream(cwd);
  if (upstreamBranch) {
    return { mode: "base-branch", ref: upstreamBranch, label: upstreamBranch };
  }

  // Get all local and remote branches merged into HEAD in one call.
  const mergedOutput = await execGit(
    [
      "for-each-ref",
      "--format=%(refname:short)",
      "--merged",
      "HEAD",
      "refs/heads/",
      "refs/remotes/",
    ],
    { cwd },
  );
  const mergedBranches = mergedOutput
    .split(/\r?\n/)
    .filter(Boolean)
    .filter((b) => b !== currentBranch)
    .filter((branch) => !branch.endsWith("/HEAD"))
    .sort();

  if (mergedBranches.length === 0) {
    const rootCommit = await getRootCommit(cwd);
    return rootCommit ? { mode: "base-branch", ref: rootCommit, label: "root commit" } : null;
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
    return { mode: "base-branch", ref: best.branch, label: best.branch };
  }

  const rootCommit = await getRootCommit(cwd);
  if (rootCommit) {
    return { mode: "base-branch", ref: rootCommit, label: "root commit" };
  }

  return { mode: "base-branch", ref: mergedBranches[0]!, label: mergedBranches[0]! };
}

/**
 * Parse "XY path" or "XY\0path" lines from git diff --name-status
 */
function parseDiffNameStatusLine(
  line: string,
): { path: string; originalPath?: string; status: string } | null {
  if (!line || line.length < 2) return null;
  const status = line[0] ?? "";
  const rest = line.slice(1).trimStart();

  if (!rest) return null;

  // Handle renames: "R100\told -> new"
  if (status === "R" || status === "C") {
    const arrowIndex = rest.indexOf(" -> ");
    if (arrowIndex !== -1) {
      const originalPath = rest.slice(0, arrowIndex);
      const path = rest.slice(arrowIndex + 4);
      if (originalPath && path) {
        return { path, originalPath, status };
      }
    }

    const parts = rest.split("\t").filter(Boolean);
    if (parts.length >= 2) {
      const originalPath = parts[parts.length - 2]!;
      const path = parts[parts.length - 1]!;

      if (originalPath && path) {
        return { path, originalPath, status };
      }
    }
  }

  // Strip leading tab from name-status output
  const path = rest.startsWith("\t") ? rest.slice(1) : rest;
  return { path, status: status || " " };
}

/**
 * Get list of changed files between a base branch and HEAD
 */
export async function getBranchDiffFiles(
  baseBranch: string,
  cwd?: string,
): Promise<GitStatusFile[]> {
  return getDiffFiles(baseBranch, "HEAD", cwd);
}
