import { execSync } from "child_process";

/**
 * Execute a git command and return the output
 */
export function execGit(
  args: string[],
  options: { cwd?: string; encoding?: BufferEncoding; input?: string | Buffer } = {},
): string {
  const { cwd = process.cwd(), encoding = "utf-8", input } = options;

  try {
    const result = execSync(`git ${args.join(" ")}`, {
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
