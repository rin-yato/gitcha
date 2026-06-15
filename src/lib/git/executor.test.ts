import { describe, expect, test } from "bun:test";

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { Result } from "better-result";

import type { GitExecutionError } from "./errors";
import { GitExecutor } from "./executor";

function withTempRepo(fn: (dir: string) => Promise<void>): () => Promise<void> {
  return async () => {
    const dir = mkdtempSync(join(tmpdir(), "gitcha-exec-test-"));
    try {
      const executor = new GitExecutor({ maxConcurrency: 6 });
      const init = await executor.runText(["init"], { cwd: dir });
      if (Result.isError(init)) throw new Error(`git init failed: ${init.error.message}`);
      writeFileSync(join(dir, "test.txt"), "hello world\n");
      await executor.runText(["add", "test.txt"], { cwd: dir });
      await executor.runText(
        [
          "-c",
          "user.name=Test",
          "-c",
          "user.email=test@test.com",
          "commit",
          "-m",
          "initial",
          "--no-gpg-sign",
        ],
        { cwd: dir },
      );
      await fn(dir);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

describe("GitExecutor integration", () => {
  // --- Successful execution ---

  test(
    "returns Result.ok with output on success",
    withTempRepo(async (dir) => {
      const executor = new GitExecutor({ maxConcurrency: 1 });
      const result = await executor.runText(["status"], { cwd: dir });

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value).toContain("nothing to commit");
      }
    }),
  );

  test(
    "returns structured output with run()",
    withTempRepo(async (dir) => {
      const executor = new GitExecutor({ maxConcurrency: 1 });
      const result = await executor.run(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir });

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.exitCode).toBe(0);
        expect(result.value.stdoutText.trim()).toMatch(/^[\w-]+$/);
      }
    }),
  );

  // --- Non-zero exit ---

  test(
    "returns GitExecutionError on non-zero exit",
    withTempRepo(async (dir) => {
      const executor = new GitExecutor({ maxConcurrency: 1 });
      const result = await executor.runText(["show", "nonexistent-ref"], { cwd: dir });

      expect(Result.isError(result)).toBe(true);
      if (Result.isError(result)) {
        expect(result.error.constructor.name).toBe("GitExecutionError");
        const err = result.error as GitExecutionError;
        expect(err.stderr).not.toBe("");
      }
    }),
  );

  // --- successExitCodes override ---

  test(
    "non-zero exit with custom success exit codes returns ok",
    withTempRepo(async (dir) => {
      const executor = new GitExecutor({ maxConcurrency: 1 });
      const result = await executor.runText(["grep", "nonexistentpattern123"], {
        cwd: dir,
        successExitCodes: [0, 1],
      });

      expect(Result.isOk(result)).toBe(true);
    }),
  );

  // --- ENOENT (missing git binary) ---

  test("returns GitMissingError when git binary not found", async () => {
    const executor = new GitExecutor({
      binary: "nonexistent-git-binary-xyz",
      maxConcurrency: 1,
    });
    const result = await executor.runText(["status"]);

    expect(Result.isError(result)).toBe(true);
    if (Result.isError(result)) {
      expect(result.error.constructor.name).toBe("GitMissingError");
    }
  });

  // --- Timeout ---

  test(
    "returns GitTimeoutError when command times out",
    withTempRepo(async (dir) => {
      const executor = new GitExecutor({ maxConcurrency: 1, timeoutMs: 1 });
      const result = await executor.runText(["-c", "core.pager=cat", "log", "-p", "--all"], {
        cwd: dir,
      });

      expect(Result.isError(result)).toBe(true);
      if (Result.isError(result)) {
        expect(result.error.constructor.name).toBe("GitTimeoutError");
      }
    }),
  );

  // --- Cancellation via AbortSignal ---

  test(
    "cancels via AbortSignal and returns GitCancellationError",
    withTempRepo(async (dir) => {
      const executor = new GitExecutor({ maxConcurrency: 1 });
      const controller = new AbortController();

      const promise = executor.runText(["-c", "core.pager=cat", "log", "-p", "--all"], {
        cwd: dir,
        signal: controller.signal,
      });

      controller.abort("user cancelled");

      const result = await promise;
      expect(Result.isError(result)).toBe(true);
      if (Result.isError(result)) {
        expect(result.error.constructor.name).toBe("GitCancellationError");
      }
    }),
  );

  // --- Deduplication ---

  test(
    "deduplicates concurrent identical commands (same run() promise)",
    withTempRepo(async (dir) => {
      let startCount = 0;
      const executor = new GitExecutor({
        maxConcurrency: 5,
        logger: {
          onStart: () => {
            startCount++;
          },
        },
      });

      const p1 = executor.runText(["status"], { cwd: dir, dedupe: true });
      const p2 = executor.runText(["status"], { cwd: dir, dedupe: true });

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(Result.isOk(r1)).toBe(true);
      expect(Result.isOk(r2)).toBe(true);
      expect(startCount).toBe(1);
    }),
  );

  test(
    "does not deduplicate when dedupe is false",
    withTempRepo(async (dir) => {
      let startCount = 0;
      const executor = new GitExecutor({
        maxConcurrency: 5,
        logger: {
          onStart: () => {
            startCount++;
          },
        },
      });

      const p1 = executor.runText(["status"], { cwd: dir, dedupe: false });
      const p2 = executor.runText(["status"], { cwd: dir, dedupe: false });

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(Result.isOk(r1)).toBe(true);
      expect(Result.isOk(r2)).toBe(true);
      expect(startCount).toBe(2);
    }),
  );

  // --- Semaphore concurrency control ---

  test(
    "completes multiple commands within concurrency limit",
    withTempRepo(async (dir) => {
      const executor = new GitExecutor({ maxConcurrency: 2 });

      const promises = [
        executor.runText(["status"], { cwd: dir }),
        executor.runText(["status"], { cwd: dir }),
        executor.runText(["status"], { cwd: dir }),
      ];

      const results = await Promise.all(promises);

      for (const r of results) {
        expect(Result.isOk(r)).toBe(true);
      }
    }),
  );

  test(
    "respects maxConcurrency of 1",
    withTempRepo(async (dir) => {
      const executor = new GitExecutor({ maxConcurrency: 1 });

      const results = await Promise.all([
        executor.runText(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir }),
        executor.runText(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir }),
        executor.runText(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: dir }),
      ]);

      for (const r of results) {
        expect(Result.isOk(r)).toBe(true);
        if (Result.isOk(r)) {
          expect(r.value.trim()).toMatch(/^[\w-]+$/);
        }
      }
    }),
  );

  // --- Buffer overflow ---

  test(
    "returns GitOutputLimitError when output exceeds limit",
    withTempRepo(async (dir) => {
      const executor = new GitExecutor({ maxConcurrency: 1, maxBufferBytes: 16 });

      const result = await executor.runText(["status"], { cwd: dir });

      expect(Result.isError(result)).toBe(true);
      if (Result.isError(result)) {
        expect(result.error.constructor.name).toBe("GitOutputLimitError");
      }
    }),
  );

  // --- runWithInput ---

  test(
    "pipes input via stdin",
    withTempRepo(async (dir) => {
      const executor = new GitExecutor({ maxConcurrency: 1 });

      const result = await executor.run(["hash-object", "-w", "--stdin"], {
        cwd: dir,
        input: "test content\n",
      });

      expect(Result.isOk(result)).toBe(true);
      if (Result.isOk(result)) {
        expect(result.value.exitCode).toBe(0);
        expect(result.value.stdoutText.trim()).toHaveLength(40);
      }
    }),
  );

  // --- Invalid CWD ---

  test("returns error for invalid working directory", async () => {
    const executor = new GitExecutor({ maxConcurrency: 1 });

    const result = await executor.runText(["status"], {
      cwd: "/nonexistent/path/xyz",
    });

    expect(Result.isError(result)).toBe(true);
    if (Result.isError(result)) {
      expect(result.error.constructor.name).toBe("GitInvalidWorkingDirectoryError");
    }
  });

  // --- onStdout/onStderr callbacks ---

  test(
    "invokes onStdout and onStderr callbacks",
    withTempRepo(async (dir) => {
      const executor = new GitExecutor({ maxConcurrency: 1 });

      let stdoutChunks = 0;
      let _stderrChunks = 0;

      const result = await executor.run(["status"], {
        cwd: dir,
        onStdout: () => {
          stdoutChunks++;
        },
        onStderr: () => {
          _stderrChunks++;
        },
      });

      expect(Result.isOk(result)).toBe(true);
      expect(stdoutChunks).toBeGreaterThan(0);
    }),
  );

  // --- Logger hooks ---

  test(
    "invokes logger onStart and onFinish",
    withTempRepo(async (dir) => {
      let started = false;
      let finished = false;

      const executor = new GitExecutor({
        maxConcurrency: 1,
        logger: {
          onStart: () => {
            started = true;
          },
          onFinish: () => {
            finished = true;
          },
        },
      });

      const result = await executor.runText(["status"], { cwd: dir });

      expect(Result.isOk(result)).toBe(true);
      expect(started).toBe(true);
      expect(finished).toBe(true);
    }),
  );

  // --- Deduplication cleanup ---

  test(
    "cleans up dedupe cache after first call resolves",
    withTempRepo(async (dir) => {
      let startCount = 0;
      const executor = new GitExecutor({
        maxConcurrency: 5,
        logger: {
          onStart: () => {
            startCount++;
          },
        },
      });

      await executor.runText(["rev-parse", "HEAD"], { cwd: dir, dedupe: true });
      await executor.runText(["rev-parse", "HEAD"], { cwd: dir, dedupe: true });

      expect(startCount).toBe(2);
    }),
  );

  // --- Pre-aborted signal ---

  test(
    "returns GitCancellationError for already-aborted signal",
    withTempRepo(async (dir) => {
      const executor = new GitExecutor({ maxConcurrency: 1 });
      const controller = new AbortController();
      controller.abort("already done");

      const result = await executor.runText(["status"], {
        cwd: dir,
        signal: controller.signal,
      });

      expect(Result.isError(result)).toBe(true);
      if (Result.isError(result)) {
        expect(result.error.constructor.name).toBe("GitCancellationError");
      }
    }),
  );

  // --- Default timeout does not trigger for fast commands ---

  test(
    "completes fast command within default timeout",
    withTempRepo(async (dir) => {
      const executor = new GitExecutor({ maxConcurrency: 1 });

      const result = await executor.runText(["rev-parse", "--show-toplevel"], {
        cwd: dir,
      });

      expect(Result.isOk(result)).toBe(true);
    }),
  );
});
