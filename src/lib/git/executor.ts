import { spawn } from "node:child_process";
import { existsSync, statSync } from "node:fs";

import { Result } from "better-result";

import {
  GitCancellationError,
  GitExecutionError,
  GitInvalidWorkingDirectoryError,
  GitMissingError,
  GitOutputLimitError,
  GitTimeoutError,
} from "./errors";
import type { GitCommandOptions, GitCommandOutput, GitResult } from "./types";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_BUFFER_BYTES = 64 * 1024 * 1024;
const DEFAULT_MAX_CONCURRENCY = 6;
const KILL_GRACE_MS = 1000;

type ExecutorOptions = {
  binary?: string;
  timeoutMs?: number;
  maxBufferBytes?: number;
  maxConcurrency?: number;
  env?: NodeJS.ProcessEnv;
  logger?: GitExecutorLogger;
};

export type GitExecutorLogger = {
  onStart?: (event: { args: readonly string[]; cwd: string }) => void;
  onFinish?: (event: {
    args: readonly string[];
    cwd: string;
    exitCode: number | null;
    durationMs: number;
  }) => void;
};

class AsyncSemaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly limit: number) {}

  async acquire(signal?: AbortSignal): Promise<(() => void) | null> {
    if (signal?.aborted) return null;

    if (this.active < this.limit) {
      this.active += 1;
      return () => this.release();
    }

    return new Promise((resolve) => {
      const start = () => {
        signal?.removeEventListener("abort", abort);
        if (signal?.aborted) {
          resolve(null);
          return;
        }

        this.active += 1;
        resolve(() => this.release());
      };
      const abort = () => {
        const index = this.queue.indexOf(start);
        if (index >= 0) this.queue.splice(index, 1);
        resolve(null);
      };

      signal?.addEventListener("abort", abort, { once: true });
      this.queue.push(start);
    });
  }

  private release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

function normalizeCwd(cwd?: string): GitResult<string, GitInvalidWorkingDirectoryError> {
  const resolved = cwd ?? process.cwd();

  try {
    if (!existsSync(resolved) || !statSync(resolved).isDirectory()) {
      return Result.err(
        new GitInvalidWorkingDirectoryError({
          args: [],
          cwd: resolved,
          message: `Invalid git working directory: ${resolved}`,
          cause: null,
        }),
      );
    }
  } catch (cause) {
    return Result.err(
      new GitInvalidWorkingDirectoryError({
        args: [],
        cwd: resolved,
        message: `Invalid git working directory: ${resolved}`,
        cause,
      }),
    );
  }

  return Result.ok(resolved);
}

function inputBuffer(input: GitCommandOptions["input"]): Buffer | null {
  if (input === undefined) return null;
  if (Buffer.isBuffer(input)) return input;
  if (typeof input === "string") return Buffer.from(input);
  return Buffer.from(input);
}

function signalReason(signal?: AbortSignal): string | null {
  if (!signal?.aborted) return null;
  const reason = signal.reason;
  return typeof reason === "string" ? reason : reason instanceof Error ? reason.message : null;
}

function commandKey(
  args: readonly string[],
  options: GitCommandOptions,
  cwd: string,
): string | null {
  if (!options.dedupe || options.input || options.onStdout || options.onStderr) return null;

  return JSON.stringify({
    cwd,
    args,
    env: options.env ?? null,
    successExitCodes: options.successExitCodes ?? [0],
    encoding: options.encoding ?? "utf-8",
  });
}

export class GitExecutor {
  private readonly binary: string;
  private readonly timeoutMs: number;
  private readonly maxBufferBytes: number;
  private readonly env?: NodeJS.ProcessEnv;
  private readonly logger?: GitExecutorLogger;
  private readonly semaphore: AsyncSemaphore;
  private readonly inflight = new Map<string, Promise<GitResult<GitCommandOutput>>>();

  constructor(options: ExecutorOptions | string = {}) {
    const normalized = typeof options === "string" ? { binary: options } : options;
    this.binary = normalized.binary ?? "git";
    this.timeoutMs = normalized.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxBufferBytes = normalized.maxBufferBytes ?? DEFAULT_MAX_BUFFER_BYTES;
    this.env = normalized.env;
    this.logger = normalized.logger;
    this.semaphore = new AsyncSemaphore(normalized.maxConcurrency ?? DEFAULT_MAX_CONCURRENCY);
  }

  async run(
    args: readonly string[],
    options: GitCommandOptions = {},
  ): Promise<GitResult<GitCommandOutput>> {
    const cwdResult = normalizeCwd(options.cwd);
    if (Result.isError(cwdResult)) {
      const error = cwdResult.error;
      return Result.err(
        new GitInvalidWorkingDirectoryError({
          args,
          cwd: error.cwd,
          message: error.message,
          cause: error.cause,
        }),
      );
    }

    const cwd = cwdResult.value;
    const key = commandKey(args, options, cwd);

    if (!key) {
      return this.runQueued(args, cwd, options);
    }

    const existing = this.inflight.get(key);
    if (existing) return existing;

    let promise: Promise<GitResult<GitCommandOutput>>;
    promise = this.runQueued(args, cwd, options).finally(() => {
      if (this.inflight.get(key) === promise) {
        this.inflight.delete(key);
      }
    });

    this.inflight.set(key, promise);
    return promise;
  }

  async runText(
    args: readonly string[],
    options: GitCommandOptions = {},
  ): Promise<GitResult<string>> {
    const result = await this.run(args, options);
    return result.map((output) => output.stdoutText);
  }

  runWithInput(
    args: readonly string[],
    input: string,
    cwd?: string,
  ): Promise<GitResult<string>> {
    return this.runText(args, { cwd, input });
  }

  private async runQueued(
    args: readonly string[],
    cwd: string,
    options: GitCommandOptions,
  ): Promise<GitResult<GitCommandOutput>> {
    const release = await this.semaphore.acquire(options.signal);
    if (!release) {
      return Result.err(
        new GitCancellationError({
          args,
          cwd,
          message: "Git command was cancelled before it started",
          reason: signalReason(options.signal),
        }),
      );
    }

    try {
      return await this.spawnCommand(args, cwd, options);
    } finally {
      release();
    }
  }

  private spawnCommand(
    args: readonly string[],
    cwd: string,
    options: GitCommandOptions,
  ): Promise<GitResult<GitCommandOutput>> {
    if (options.signal?.aborted) {
      return Promise.resolve(
        Result.err(
          new GitCancellationError({
            args,
            cwd,
            message: "Git command was cancelled before it started",
            reason: signalReason(options.signal),
          }),
        ),
      );
    }

    const startedAt = Date.now();
    const encoding = options.encoding ?? "utf-8";
    const maxBufferBytes = options.maxBufferBytes ?? this.maxBufferBytes;
    const timeoutMs = options.timeoutMs ?? this.timeoutMs;
    const successExitCodes = new Set(options.successExitCodes ?? [0]);
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutSize = 0;
    let stderrSize = 0;
    let settled = false;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    let killTimeout: ReturnType<typeof setTimeout> | null = null;
    let terminalError:
      | GitCancellationError
      | GitTimeoutError
      | GitOutputLimitError
      | GitMissingError
      | null = null;

    this.logger?.onStart?.({ args, cwd });

    return new Promise((resolve) => {
      const child = spawn(this.binary, [...args], {
        cwd,
        env: { ...process.env, ...this.env, ...options.env },
        stdio: [options.input === undefined ? "ignore" : "pipe", "pipe", "pipe"],
      });

      const finish = (result: GitResult<GitCommandOutput>, exitCode: number | null) => {
        if (settled) return;
        settled = true;
        if (timeout) clearTimeout(timeout);
        if (killTimeout) clearTimeout(killTimeout);
        options.signal?.removeEventListener("abort", abort);
        this.logger?.onFinish?.({
          args,
          cwd,
          exitCode,
          durationMs: Date.now() - startedAt,
        });
        resolve(result);
      };

      const kill = () => {
        if (!child.killed) child.kill("SIGTERM");
        killTimeout = setTimeout(() => {
          if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
        }, KILL_GRACE_MS);
      };

      const abort = () => {
        terminalError = new GitCancellationError({
          args,
          cwd,
          message: "Git command was cancelled",
          reason: signalReason(options.signal),
        });
        kill();
      };

      const append = (
        chunk: Buffer,
        chunks: Buffer[],
        currentSize: number,
        onChunk?: (chunk: Buffer) => void,
      ) => {
        const nextSize = currentSize + chunk.length;
        if (nextSize > maxBufferBytes && !terminalError) {
          terminalError = new GitOutputLimitError({
            args,
            cwd,
            message: `Git command output exceeded ${maxBufferBytes} bytes`,
            maxBufferBytes,
          });
          kill();
          return currentSize;
        }

        chunks.push(chunk);
        onChunk?.(chunk);
        return nextSize;
      };

      options.signal?.addEventListener("abort", abort, { once: true });

      if (timeoutMs > 0) {
        timeout = setTimeout(() => {
          if (terminalError) return;
          terminalError = new GitTimeoutError({
            args,
            cwd,
            message: `Git command timed out after ${timeoutMs}ms`,
            timeoutMs,
            stdout: Buffer.concat(stdoutChunks).toString(encoding),
            stderr: Buffer.concat(stderrChunks).toString(encoding),
          });
          kill();
        }, timeoutMs);
      }

      child.stdout?.on("data", (chunk: Buffer) => {
        stdoutSize = append(chunk, stdoutChunks, stdoutSize, options.onStdout);
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        stderrSize = append(chunk, stderrChunks, stderrSize, options.onStderr);
      });

      child.on("error", (cause: NodeJS.ErrnoException) => {
        const error =
          cause.code === "ENOENT"
            ? new GitMissingError({
                args,
                cwd,
                message: `Git executable not found: ${this.binary}`,
                cause,
              })
            : new GitExecutionError({
                args,
                cwd,
                message: cause.message,
                exitCode: null,
                signal: null,
                stdout: Buffer.concat(stdoutChunks).toString(encoding),
                stderr: Buffer.concat(stderrChunks).toString(encoding),
              });
        finish(Result.err(error), null);
      });

      child.on("close", (exitCode, signal) => {
        const stdout = Buffer.concat(stdoutChunks);
        const stderr = Buffer.concat(stderrChunks);
        const stdoutText = stdout.toString(encoding);
        const stderrText = stderr.toString(encoding);
        const durationMs = Date.now() - startedAt;

        if (terminalError) {
          finish(Result.err(terminalError), exitCode);
          return;
        }

        const normalizedExitCode = exitCode ?? 0;
        if (successExitCodes.has(normalizedExitCode)) {
          finish(
            Result.ok({
              args,
              cwd,
              exitCode: normalizedExitCode,
              signal,
              stdout,
              stderr,
              stdoutText,
              stderrText,
              durationMs,
            }),
            normalizedExitCode,
          );
          return;
        }

        finish(
          Result.err(
            new GitExecutionError({
              args,
              cwd,
              message: `Git command failed with exit code ${exitCode ?? "unknown"}`,
              exitCode,
              signal,
              stdout: stdoutText,
              stderr: stderrText,
            }),
          ),
          exitCode,
        );
      });

      const stdinInput = inputBuffer(options.input);
      if (stdinInput && child.stdin) {
        child.stdin.end(stdinInput);
      }
    });
  }
}

export class GitCommandExecutor extends GitExecutor {}

export const gitExecutor = new GitExecutor();
