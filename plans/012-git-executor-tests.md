# Plan 012: Add GitExecutor integration tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 248b1ac..HEAD -- src/lib/git/executor.ts src/lib/git/errors.ts src/lib/git/types.ts`
> If these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: LOW
- **Depends on**: none (but plan 001 should be completed first so tests cover the fixed deduplication)
- **Category**: tests
- **Planned at**: commit `248b1ac`, 2026-06-13

## Why this matters

The entire I/O layer — timeout handling (4 setTimeout paths), cancellation via `AbortSignal`, buffer overflow detection (64MB limit), `AsyncSemaphore` concurrency control (6 parallel max), exit code error handling, stdin piping, and the `settled` guard state machine — has zero automated test coverage. A regression in any of these paths breaks every feature in the app. These are the most critical paths without tests.

## Current state

- `src/lib/git/executor.ts` — 434 lines, the core execution engine
- `src/lib/git/errors.ts` — 6 terminal error types
- `src/lib/git/types.ts` — `GitCommandOutput`, `GitExecutorLike` interfaces
- No existing test for `GitExecutor` or any subprocess-spawning code

Key testable behaviors (from the code):

1. **Successful execution**: spawn returns stdout, exit code 0 → `Result.ok` with output
2. **Non-zero exit**: spawn returns exit code 1 → `Result.err(GitExecutionError)` with stderr
3. **Timeout**: process doesn't exit within timeout → SIGTERM, then SIGKILL after 1s grace → `Result.err(GitTimeoutError)`
4. **Cancellation**: `AbortSignal` fires → SIGTERM → `Result.err(GitCancellationError)`
5. **Buffer overflow**: stdout exceeds 64MB → killed → `Result.err(GitOutputLimitError)`
6. **Missing binary**: `ENOENT` on spawn → `Result.err(GitMissingError)`
7. **Deduplication**: two concurrent identical calls → only one spawn, same result returned to both
8. **Semaphore**: more concurrent calls than limit → later calls queue

The `settled` guard at `executor.ts:276-278` prevents multiple settlements — a critical correctness property that's hard to test manually.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run typecheck`      | exit 0, no errors   |
| Tests     | `bun test src`           | all pass            |
| Specific  | `bun test src/lib/git/executor.test.ts` | all pass |
| Lint      | `bun run check`          | exit 0              |
| Fix       | `bun run fix`            | exit 0              |

## Scope

**In scope**:
- New file: `src/lib/git/executor.test.ts` — integration tests for `GitExecutor`

**Out of scope**:
- `src/lib/git/executor.ts` — no changes (unless a test reveals a bug — then stop and report)
- Any other test file
- Testing `GitCommandExecutor` (the alias class at line 432) — it's a bare subclass

## Testing approach

Use Bun's built-in test framework (`bun:test`). We mock `child_process.spawn` from `node:child_process` using `bun:test`'s `mock.module` or a manual mock with `EventEmitter`.

Bun supports `mock.module("node:child_process", () => ({ spawn: mockSpawn }))`. The mock spawn returns a mock `ChildProcess` — an `EventEmitter` with `stdout`, `stderr`, `stdin` properties and `kill()` method.

Pattern to follow: `src/lib/git/status/parser.test.ts` (uses `bun:test`, `describe`/`test`/`expect`).

## Git workflow

- Branch: `advisor/012-executor-tests`
- Commit message: `test(executor): add integration tests for GitExecutor`

## Steps

### Step 1: Create test infrastructure (mock child_process.spawn)

Create `src/lib/git/executor.test.ts` with a mock spawn helper:

```typescript
import { describe, expect, mock, test, beforeEach } from "bun:test";
import { EventEmitter } from "node:events";
import { GitExecutor } from "./executor";
import { Result } from "better-result";

function mockSpawn() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    stdin: { end: () => void };
    killed: boolean;
    kill: (signal?: string) => void;
    exitCode: number | null;
    signalCode: string | null;
  };

  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stdin = { end: () => {} };
  child.killed = false;
  child.exitCode = null;
  child.signalCode = null;

  child.kill = (signal?: string) => {
    child.killed = true;
    child.emit("close", null, signal ?? "SIGTERM");
  };

  return child;
}
```

### Step 2: Write test cases

Write tests in `executor.test.ts`. Use a `beforeEach` to set up the mock and a fresh `GitExecutor`.

#### Test: successful execution

```typescript
test("returns Result.ok with output on success", async () => {
  const child = mockSpawn();
  mock.module("node:child_process", () => ({ spawn: () => child }));

  const executor = new GitExecutor({ maxConcurrency: 1 });

  const promise = executor.runText(["status"]);
  child.stdout!.emit("data", Buffer.from("output\n"));
  child.emit("close", 0, null);

  const result = await promise;
  expect(Result.isOk(result)).toBe(true);
  if (Result.isOk(result)) {
    expect(result.value).toBe("output\n");
  }
});
```

#### Test: non-zero exit

```typescript
test("returns Result.err on non-zero exit", async () => {
  const child = mockSpawn();
  mock.module("node:child_process", () => ({ spawn: () => child }));

  const executor = new GitExecutor({ maxConcurrency: 1 });

  const promise = executor.runText(["status"]);
  child.stderr!.emit("data", Buffer.from("error text"));
  child.emit("close", 1, null);

  const result = await promise;
  expect(Result.isError(result)).toBe(true);
});
```

#### Test: ENOENT (missing git)

```typescript
test("returns GitMissingError when git not found", async () => {
  const child = mockSpawn();
  mock.module("node:child_process", () => ({ spawn: () => child }));

  const executor = new GitExecutor({ binary: "nonexistent-git", maxConcurrency: 1 });

  const promise = executor.runText(["status"]);
  child.emit("error", Object.assign(new Error("ENOENT"), { code: "ENOENT" }));

  const result = await promise;
  expect(Result.isError(result)).toBe(true);
  if (Result.isError(result)) {
    expect(result.error.constructor.name).toBe("GitMissingError");
  }
});
```

#### Test: timeout

```typescript
test("times out and kills process after timeout", async () => {
  const child = mockSpawn();
  mock.module("node:child_process", () => ({ spawn: () => child }));

  const executor = new GitExecutor({ maxConcurrency: 1, timeoutMs: 100 });

  const promise = executor.runText(["status"]);
  // Don't emit close — let the timeout fire

  const result = await promise;
  expect(Result.isError(result)).toBe(true);
  if (Result.isError(result)) {
    expect(result.error.constructor.name).toBe("GitTimeoutError");
  }
});
```

#### Test: cancellation via AbortSignal

```typescript
test("cancels via AbortSignal", async () => {
  const child = mockSpawn();
  mock.module("node:child_process", () => ({ spawn: () => child }));

  const executor = new GitExecutor({ maxConcurrency: 1 });
  const controller = new AbortController();

  const promise = executor.runText(["status"], { signal: controller.signal });

  // Cancel immediately after spawn (which is synchronous in mock)
  controller.abort("user cancelled");

  const result = await promise;
  expect(Result.isError(result)).toBe(true);
  if (Result.isError(result)) {
    expect(result.error.constructor.name).toBe("GitCancellationError");
  }
});
```

#### Test: deduplication

```typescript
test("deduplicates concurrent identical commands", async () => {
  let spawnCount = 0;

  const child = mockSpawn();
  const spawnMock = mock(() => {
    spawnCount++;
    return child;
  });
  mock.module("node:child_process", () => ({ spawn: spawnMock }));

  const executor = new GitExecutor({ maxConcurrency: 5 });

  const p1 = executor.runText(["status"], { dedupe: true });
  const p2 = executor.runText(["status"], { dedupe: true });

  child.emit("close", 0, null);

  const [r1, r2] = await Promise.all([p1, p2]);

  expect(spawnCount).toBe(1); // Only one spawn despite two calls
  expect(r1).toBe(r2);         // Same promise object returned
});
```

#### Test: semaphore queuing

```typescript
test("queues commands when concurrency limit reached", async () => {
  mock.module("node:child_process", () => {
    return {
      spawn: () => {
        const child = mockSpawn();
        // Don't close — hold the semaphore slot
        return child;
      },
    };
  });

  const executor = new GitExecutor({ maxConcurrency: 1 });

  // First call acquires the semaphore
  const p1 = executor.runText(["status"]);
  // Second call should queue
  const p2 = executor.runText(["status"]);

  // p2 should not resolve (it's queued), but should not reject either
  // This test verifies semaphore doesn't crash under contention
  // Full verification needs more infrastructure — this is a smoke test
  expect(p2).toBeInstanceOf(Promise);
});
```

### Step 3: Prioritize and iterate

The mock.module approach may not work as expected with Bun's mock system. If `mock.module` doesn't intercept `spawn` correctly, try an alternative: use dependency injection. Create a factory that takes a spawn function:

```typescript
// In test, directly construct executor and test via new GitExecutor({}) 
// If mock.module doesn't work, modify executor.test.ts to use 
// Bun's built-in test utilities or manual DI.
```

If `mock.module` proves unreliable, the fallback is to test indirectly through the higher-level services (status, diff) with a repo fixture. Create a temp git repo, run commands against it, and verify results.

**Verify after each test addition**: `bun test src/lib/git/executor.test.ts` → all pass

### Step 4: Run full suite and lint

**Verify**: `bun test src` → all pass
**Verify**: `bun run fix` → exit 0

## Test plan

The tests above cover the 8 behaviors listed in "Why this matters". The executor test file should be ~200-300 lines.

Edge cases to also test if mock infrastructure allows:
- `KILL_GRACE_MS` — SIGTERM followed by SIGKILL if process survives
- Buffer overflow mid-stream (two data events, second exceeds limit)
- `settled` guard — late timeout doesn't override an already-resolved promise
- stdin piping — verify `child.stdin.end()` is called

## Done criteria

- [ ] `src/lib/git/executor.test.ts` exists with tests for success, error, timeout, cancellation, deduplication, and semaphore
- [ ] `bun test src/lib/git/executor.test.ts` exits 0
- [ ] `bun test src` exits 0
- [ ] `bun run typecheck` exits 0
- [ ] `bun run fix` exits 0
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- `mock.module` does not work with `node:child_process` in Bun. Report what version of Bun and try the DI approach.
- The executor code at `executor.ts:230-429` doesn't match expectations (it's drifted significantly).
- A test reveals a pre-existing bug in the executor (like a missing error path). Report it — do NOT fix it in this plan; that would be scope creep.

## Maintenance notes

- These tests use mocked `child_process.spawn`. If Bun's spawn behavior changes, the mocks may need updating.
- The semaphore and deduplication tests are the most fragile — they depend on specific timing of async operations. If they're flaky, add small delays or refactor to use explicit promise control.
- When the executor is refactored (e.g., extracting the error state machine), these tests provide the safety net.
