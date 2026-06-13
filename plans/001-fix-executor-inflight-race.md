# Plan 001: Fix race condition in GitExecutor inflight deduplication

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 248b1ac..HEAD -- src/lib/git/executor.ts`
> If this file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `248b1ac`, 2026-06-13

## Why this matters

`GitExecutor.run()` has a deduplication mechanism that prevents concurrent identical git commands. The inflight map entry is set AFTER calling `this.runQueued()`. Since `runQueued` contains `await this.semaphore.acquire(...)`, the async function yields before the map entry is stored. A second concurrent call with the same key can pass the `this.inflight.get(key)` check while the first is still waiting on the semaphore. This causes duplicate subprocess spawns, doubling resource usage and risking `.git/index.lock` contention.

## Current state

- `src/lib/git/executor.ts` — Git command execution with inflight deduplication (lines 159-188)

```typescript
// executor.ts:159-188
async run(
  args: readonly string[],
  options: GitCommandOptions = {},
): Promise<GitResult<GitCommandOutput>> {
  // ... cwd normalization ...

  const cwd = cwdResult.value;
  const key = commandKey(args, options, cwd);
  const cached = key ? this.inflight.get(key) : undefined;
  if (cached) return cached;

  const promise = this.runQueued(args, cwd, options);  // <-- yields here (semaphore.acquire)
  if (key) {
    this.inflight.set(key, promise);                     // <-- set AFTER the yield
    promise.finally(() => this.inflight.delete(key));
  }

  return promise;
}
```

The gap: line 181 calls `runQueued` which at line 211 does `await this.semaphore.acquire(...)`. Between lines 181 and 183, another caller can call `run`, pass the check at lines 178-179, and spawn a duplicate subprocess.

The fix is to set the map entry BEFORE calling `runQueued`, using a lazily-started promise pattern, or to restructure so the promise is stored synchronously at call time.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run typecheck`      | exit 0, no errors   |
| Tests     | `bun test src`           | all pass            |
| Lint      | `bun run check`          | exit 0              |
| Fix       | `bun run fix`            | exit 0              |

## Scope

**In scope**: `src/lib/git/executor.ts` only.

**Out of scope**: Any other file. Do not touch callers, the semaphore, or timeout logic.

## Git workflow

- Branch: `advisor/001-fix-executor-inflight-race`
- Commit message: `fix(executor): close race window in inflight command deduplication`

## Steps

### Step 1: Restructure `run` to register inflight promise synchronously

In `src/lib/git/executor.ts`, modify the `run` method (lines 159-188). The key change: build and store the promise in the inflight map BEFORE any `await`, so concurrent callers see it immediately.

Replace lines 176-188:

```typescript
const cwd = cwdResult.value;
const key = commandKey(args, options, cwd);
const cached = key ? this.inflight.get(key) : undefined;
if (cached) return cached;

const promise = this.runQueued(args, cwd, options);
if (key) {
  this.inflight.set(key, promise);
  promise.finally(() => this.inflight.delete(key));
}

return promise;
```

With this structure — the key insight is to create a `Promise`-returning wrapper that checks the inflight map FIRST, then only calls `runQueued` if there's no existing entry, and stores the promise in the map before starting execution:

```typescript
const cwd = cwdResult.value;
const key = commandKey(args, options, cwd);

if (!key) {
  return this.runQueued(args, cwd, options);
}

const existing = this.inflight.get(key);
if (existing) return existing;

// Build a promise that cleans up after itself.
// Create it synchronously and store it immediately so concurrent
// callers see it before runQueued yields on the semaphore.
let promise: Promise<GitResult<GitCommandOutput>>;
promise = this.runQueued(args, cwd, options).finally(() => {
  // Only delete if this exact promise is still the map entry
  // (protects against a stale cleanup deleting a newer entry).
  if (this.inflight.get(key) === promise) {
    this.inflight.delete(key);
  }
});

this.inflight.set(key, promise);
return promise;
```

**Verify**: `bun run typecheck` → exit 0

### Step 2: Run full test suite and lint

**Verify**: `bun test src` → all tests pass
**Verify**: `bun run fix` → exit 0

## Test plan

No new tests required — the deduplication is concurrency behavior that would need a timing-sensitive test with mocked semaphores. The existing test suite confirms no behavioral regression.

Manual verification: the original `finally` callback used `this.inflight.delete(key)` unconditionally. The new code guards with `if (this.inflight.get(key) === promise)` to prevent a stale cleanup from deleting a newer promise. The existing `includeUntracked` / dedupe tests in `src/lib/git/index.test.ts` exercise deduplication behavior.

## Done criteria

- [ ] `bun run typecheck` exits 0
- [ ] `bun test src` exits 0, all existing tests pass
- [ ] `bun run fix` exits 0
- [ ] No files outside `src/lib/git/executor.ts` are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The code at `executor.ts:159-188` doesn't match the "Current state" excerpt (the codebase has drifted).
- Any test fails after the change.
- You discover that `commandKey` can return null for non-dedupe commands AND the existing behavior changes for those paths (it should not — the `!key` early return preserves existing behavior).

## Maintenance notes

- The `commandKey()` function at `executor.ts:124-138` returns null for commands with `input`, `onStdout`, or `onStderr` — these are intentionally excluded from deduplication.
- If in the future someone adds synchronous setup between `commandKey` and `runQueued`, the inflight map registration must stay before the first `await`.
