import { execFile, spawn } from "node:child_process";
import { text } from "node:stream/consumers";

const DEFAULT_MAX_BUFFER = 10 * 1024 * 1024;

export type GitCommandOptions = {
  cwd?: string;
  encoding?: BufferEncoding;
};

type GitProcessError = Error & {
  code?: number;
  status?: number;
  stderr?: string;
};

function resolveGitOutput(
  error: GitProcessError,
  stdout: string,
  stderr: string,
): string | null {
  const exitCode = error.code ?? error.status;

  if (exitCode === 1 && stdout) {
    return stdout;
  }

  if (exitCode === 1 && !error.stderr && !stderr) {
    return "";
  }

  return null;
}

export class GitCommandExecutor {
  constructor(private readonly binary = "git") {}

  run(args: string[], options: GitCommandOptions = {}): Promise<string> {
    const { cwd = process.cwd(), encoding = "utf-8" } = options;

    return new Promise((resolve, reject) => {
      execFile(
        this.binary,
        args,
        { cwd, encoding, maxBuffer: DEFAULT_MAX_BUFFER },
        (error, stdout, stderr) => {
          if (!error) {
            resolve(stdout || "");
            return;
          }

          const execError = error as GitProcessError;
          const output = resolveGitOutput(execError, stdout || "", stderr || "");
          if (output !== null) {
            resolve(output);
            return;
          }

          reject(new Error(`Git command failed: ${execError.message}`));
        },
      );
    });
  }

  runWithInput(args: string[], input: string, cwd?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn(this.binary, args, {
        cwd: cwd ?? process.cwd(),
        stdio: ["pipe", "pipe", "pipe"],
      });

      const stdoutPromise = text(child.stdout);
      const stderrPromise = text(child.stderr);
      const exitCodePromise = new Promise<number | null>((resolveExit) => {
        child.on("close", resolveExit);
      });

      void Promise.all([stdoutPromise, stderrPromise, exitCodePromise]).then(
        ([stdout, stderr, code]) => {
          if (code === 0) {
            resolve(stdout || "");
            return;
          }

          if (code === 1 && stdout) {
            resolve(stdout);
            return;
          }

          if (code === 1 && !stderr) {
            resolve("");
            return;
          }

          reject(new Error(`Git command failed: ${stderr || `exit code ${code}`}`));
        },
      );

      child.on("error", (err) => {
        reject(new Error(`Git command failed: ${err.message}`));
      });

      child.stdin.write(input);
      child.stdin.end();
    });
  }

  async isGitRepo(cwd?: string): Promise<boolean> {
    try {
      await this.run(["rev-parse", "--git-dir"], { cwd });
      return true;
    } catch {
      return false;
    }
  }

  async getRepoRoot(cwd?: string): Promise<string> {
    return (await this.run(["rev-parse", "--show-toplevel"], { cwd })).trim();
  }

  async stageFile(filePath: string, cwd?: string): Promise<void> {
    await this.run(["add", "--", filePath], { cwd });
  }

  async unstageFile(filePath: string, cwd?: string): Promise<void> {
    await this.run(["reset", "HEAD", "--", filePath], { cwd });
  }

  async discardChanges(filePath: string, cwd?: string): Promise<void> {
    try {
      await this.run(["checkout", "--", filePath], { cwd });
    } catch {
      await this.run(["clean", "-f", "--", filePath], { cwd });
    }
  }

  async commitChanges(message: string, cwd?: string): Promise<void> {
    await this.runWithInput(["commit", "--file", "-"], `${message.trim()}\n`, cwd);
  }

  async pushChanges(cwd?: string): Promise<void> {
    await this.run(["push"], { cwd });
  }

  async pullChanges(cwd?: string): Promise<void> {
    await this.run(["pull", "--ff-only"], { cwd });
  }

  async getFileVersion(ref: string, filePath: string, cwd?: string): Promise<string | null> {
    try {
      return await this.run(["show", `${ref}:${filePath}`], { cwd });
    } catch {
      return null;
    }
  }
}

export const gitExecutor = new GitCommandExecutor();
