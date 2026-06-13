# Plan 007: File watcher to replace 1-second git polling

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 248b1ac..HEAD -- src/component/sidebar/index.tsx src/lib/git/types.ts`
> If these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 006 (chokidar must be in devDependencies before this plan moves it back to dependencies)
- **Category**: perf
- **Planned at**: commit `248b1ac`, 2026-06-13

## Why this matters

The sidebar polls `git status --porcelain=v1 -z --branch --untracked-files=all` every 1 second unconditionally, even when no files change. On large repos this generates steady CPU and I/O waste. The types already define `RepoMonitorMode = "native" | "polling"` at `types.ts:183` and `RepoMonitor`/`RepoChangeListener` interfaces exist, but no native watcher is implemented. `chokidar` is already declared as a dependency (currently in devDependencies after plan 006); this plan uses it to watch the repo for file changes and trigger `gitStore.refresh()` only when something actually changes, with a 300ms debounce.

## Current state

- `src/component/sidebar/index.tsx:26-36` — polling interval
- `src/lib/git/types.ts:183-190` — `RepoMonitorMode`, `RepoMonitor`, `RepoChangeListener` types

```typescript
// sidebar/index.tsx:26-36
onMount(() => {
  const interval = setInterval(() => {
    if (!review.state.active) void gitStore.refresh();
  }, 1000);

  void gitStore.refresh();

  onCleanup(() => {
    clearInterval(interval);
  });
});
```

```typescript
// types.ts:183-190 — existing types to use
export type RepoMonitorMode = "native" | "polling";

export type RepoChangeListener = (kind: RepoChangeKind) => void;

export interface RepoMonitor {
  mode: RepoMonitorMode;
  dispose: () => Promise<void>;
}

export type RepoChangeKind = "content" | "metadata";
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Typecheck | `bun run typecheck`      | exit 0, no errors   |
| Tests     | `bun test src`           | all pass            |
| Lint      | `bun run check`          | exit 0              |
| Fix       | `bun run fix`            | exit 0              |

## Scope

**In scope**:
- `src/lib/git/types.ts` — add `RepoChangeListener` export if needed (already exported)
- `src/lib/git/index.ts` — export new `RepoWatcher` class
- New file: `src/lib/watcher.ts` — native file watcher implementation (NOT under `src/lib/git/` — it's a cross-cutting concern)
- `src/component/sidebar/index.tsx` — replace `setInterval` with watcher
- `package.json` — move `chokidar` from `devDependencies` back to `dependencies`

**Out of scope**:
- `src/lib/git/executor.ts` — no changes to executor
- `src/context/git.tsx` — no changes to the git store; we call `refresh()` through the existing API
- The review mode — only watch when NOT in review mode (the existing guard `if (!review.state.active)` is preserved)

## Git workflow

- Branch: `advisor/007-file-watcher`
- Commit message: `perf(sidebar): replace 1s git polling with native file watcher`

## Steps

### Step 1: Move chokidar back to dependencies

If plan 006 was executed first: move `chokidar` from `devDependencies` to `dependencies` in `package.json`. If plan 006 was NOT executed and chokidar is already in `dependencies`, skip this step.

Run `bun install`.

### Step 2: Create file watcher module

Create `src/lib/watcher.ts` with a `createRepoWatcher` function that:
- Takes a repo root path and a callback.
- Watches the repo with `chokidar.watch(repoRoot, { ignored: /(^|[/\\])\.git[/\\]/, ignoreInitial: true })`.
- Debounces change events by 300ms before calling the callback.
- Returns a `RepoMonitor` with a `dispose()` method that closes the watcher.
- Falls back gracefully: if chokidar fails to initialize, returns `{ mode: "polling" }` so callers can start a polling fallback.

```typescript
import chokidar from "chokidar";
import type { RepoChangeListener, RepoMonitor, RepoMonitorMode } from "./git/types";

export function createRepoWatcher(
  repoRoot: string,
  onChange: RepoChangeListener,
): RepoMonitor {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let mode: RepoMonitorMode = "polling";

  try {
    const watcher = chokidar.watch(repoRoot, {
      ignored: /(^|[/\\])\.git[/\\]/,
      ignoreInitial: true,
      persistent: true,
    });

    mode = "native";

    const schedule = (kind: RepoChangeListener extends (k: infer K) => void ? K : never) => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onChange(kind), 300);
    };

    watcher.on("change", () => schedule("content"));
    watcher.on("add", () => schedule("content"));
    watcher.on("unlink", () => schedule("content"));
  } catch {
    mode = "polling";
  }

  return {
    mode,
    dispose: async () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      // chokidar watcher is closed via the try block's scope;
      // if mode is "polling", there's nothing to dispose
    },
  };
}
```

Wait — the `chokidar.watch()` returns a `FSWatcher` that needs to be closed. Store the reference:

```typescript
export function createRepoWatcher(
  repoRoot: string,
  onChange: RepoChangeListener,
): RepoMonitor {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let watcher: chokidar.FSWatcher | null = null;
  let mode: RepoMonitorMode = "polling";

  try {
    watcher = chokidar.watch(repoRoot, {
      ignored: /(^|[/\\])\.git[/\\]/,
      ignoreInitial: true,
      persistent: true,
    });

    mode = "native";

    const schedule = (kind: "content" | "metadata") => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => onChange(kind), 300);
    };

    watcher.on("change", () => schedule("content"));
    watcher.on("add", () => schedule("content"));
    watcher.on("unlink", () => schedule("content"));
  } catch {
    mode = "polling";
  }

  return {
    mode,
    dispose: async () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      if (watcher) await watcher.close();
    },
  };
}
```

**Verify**: `bun run typecheck` → exit 0

### Step 3: Update sidebar to use watcher with polling fallback

In `src/component/sidebar/index.tsx`, replace the `onMount` block (lines 26-36). The new logic:
1. On mount: get the repo root from `git.getRepoRoot()`, create a watcher, and start it.
2. If the watcher mode is `"polling"`, fall back to `setInterval` (the existing code).
3. On cleanup: dispose the watcher AND clear the interval.

The sidebar needs `git` (the Git client instance) imported.

```typescript
import { git } from "@/lib/git";
import { createRepoWatcher } from "@/lib/watcher";

// Replace lines 26-36 (the onMount block) with:
onMount(async () => {
  const rootResult = await git.getRepoRoot();
  if (Result.isError(rootResult)) {
    // Can't determine repo root — fall back to polling
    const interval = setInterval(() => {
      if (!review.state.active) void gitStore.refresh();
    }, 1000);
    onCleanup(() => clearInterval(interval));
    return;
  }

  const watcher = createRepoWatcher(rootResult.value, () => {
    if (!review.state.active) void gitStore.refresh();
  });

  // Initial refresh
  void gitStore.refresh();

  // Polling fallback
  let interval: ReturnType<typeof setInterval> | null = null;
  if (watcher.mode === "polling") {
    interval = setInterval(() => {
      if (!review.state.active) void gitStore.refresh();
    }, 1000);
  }

  onCleanup(() => {
    if (interval) clearInterval(interval);
    void watcher.dispose();
  });
});
```

Note: `Result` is already imported from `better-result` in some form. Check the imports and add `import { Result } from "better-result"` if needed.

**Verify**: `bun run typecheck` → exit 0

### Step 4: Run tests and lint

**Verify**: `bun test src` → all pass
**Verify**: `bun run fix` → exit 0

## Test plan

No new tests for the watcher integration — it's I/O bound and would require filesystem mocking infrastructure not yet present. The polling fallback is the existing behavior, which is already exercised.

If you want to add a unit test for `createRepoWatcher`, it would need to mock `chokidar`. Skip for now — the watcher code is intentionally simple (watcher + debounce + fallback).

## Done criteria

- [ ] `src/lib/watcher.ts` exists with `createRepoWatcher`
- [ ] `src/component/sidebar/index.tsx` uses watcher with polling fallback
- [ ] `chokidar` is in `dependencies` in `package.json`
- [ ] `bun run typecheck` exits 0
- [ ] `bun test src` exits 0
- [ ] `bun run fix` exits 0
- [ ] Only files in "In scope" are modified/created
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The sidebar `onMount` block doesn't match the excerpt.
- `chokidar.watch()` API has changed significantly from v5 (check `bun.lock` for the exact version).
- `git.getRepoRoot()` returns an error in a valid git repo (test manually with `bun run preview`).
- The typecheck reveals imports missing from `src/lib/git/index.ts` barrel.

## Maintenance notes

- The polling fallback is critical: some environments (network drives, Docker volumes on macOS) don't reliably fire filesystem events. The watcher `mode` field communicates this to callers.
- If `chokidar` is ever replaced with Bun's built-in `fs.watch`, the `createRepoWatcher` function is the single place to change.
- The `ignored` pattern excludes `.git/` from watching — git's own operations trigger writes there that would cause unnecessary refreshes.
