# Plan 002: Fix DiffPane error handling — use Result instead of unwrap

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 248b1ac..HEAD -- src/component/diff-pane/index.tsx src/lib/git/errors.ts`
> If these files changed since this plan was written, compare the
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

`DiffPane` uses `Result.unwrap` on git diff results, which throws on error variants. The project convention is "never throw" — use `Result` typed errors throughout. The thrown error is caught by `createResource` and displayed as `String(diffResource.error)`, which loses the structured error information (stderr, exit code) that `formatGitError` from `src/lib/git/errors.ts:86-92` would surface. Users see bare messages instead of actionable error text.

## Current state

- `src/component/diff-pane/index.tsx` — main diff pane component (lines 27-38)
- `src/lib/git/errors.ts` — `formatGitError` helper (lines 86-92)

```typescript
// diff-pane/index.tsx:27-38
const [diffResource] = createResource(
  () => selectedFile(),
  async (file) => {
    if (!file) return undefined;
    if (review.state.active) {
      const target = review.state.target;
      if (!target) return undefined;
      return git.review.diff(target, toGitUnifiedDiffTarget(file)).then(Result.unwrap);
    }
    return git.diff.get(toGitUnifiedDiffTarget(file)).then(Result.unwrap);
  },
);

// diff-pane/index.tsx:45-49 — error display
<Match when={diffResource.error}>
  <box width="100%" height="100%" alignItems="center" justifyContent="center">
    <text fg="red">Error: {String(diffResource.error)}</text>
  </box>
</Match>
```

```typescript
// errors.ts:86-92 — what we should be using instead
export function formatGitError(error: GitError): string {
  if ("stderr" in error && error.stderr) {
    return `${error.message}: ${error.stderr.trim()}`;
  }
  return error.message;
}
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run typecheck`      | exit 0, no errors   |
| Tests     | `bun test src`           | all pass            |
| Lint      | `bun run check`          | exit 0              |
| Fix       | `bun run fix`            | exit 0              |

## Scope

**In scope**: `src/component/diff-pane/index.tsx` only.

**Out of scope**: `src/lib/git/errors.ts`, `src/lib/git/review/service.ts`, `src/lib/git/diff/service.ts` — they already return `Result` types correctly. Do not modify them.

## Git workflow

- Branch: `advisor/002-fix-diffpane-result-unwrap`
- Commit message: `fix(diff-pane): use Result instead of unwrap to preserve error details`

## Steps

### Step 1: Change fetcher to return Result instead of unwrapping

In `src/component/diff-pane/index.tsx`, replace the `createResource` fetcher (lines 27-38). Instead of `.then(Result.unwrap)`, return the `Result` itself. The resource will hold the Result, and the template will branch on it.

Also add imports for `formatGitError` and `GitError`.

New fetcher shape:

```typescript
import { formatGitError, type GitError } from "@/lib/git";

// Inside DiffPane, replace lines 27-38:
const [diffResource] = createResource(
  () => selectedFile(),
  async (file): Promise<Result<string, GitError> | undefined> => {
    if (!file) return undefined;
    if (review.state.active) {
      const target = review.state.target;
      if (!target) return undefined;
      return git.review.diff(target, toGitUnifiedDiffTarget(file));
    }
    return git.diff.get(toGitUnifiedDiffTarget(file));
  },
);
```

### Step 2: Update the template to branch on Result.isError

Replace the error Match block (lines 45-49) to handle the Result type. Use `Show` with a computed error message instead of `Match`:

```typescript
// Replace lines 45-49 with:
<Match when={diffResource() && Result.isError(diffResource())}>
  <box width="100%" height="100%" alignItems="center" justifyContent="center">
    <text fg="red">Error: {formatGitError((diffResource() as Result<string, GitError>).error)}</text>
  </box>
</Match>
```

And the success Match (line 50-51) should unwrap the value:

```typescript
<Match when={diffResource() && Result.isOk(diffResource())}>
  {(result) => <Diff filePath={selectedFile()!.file.path} diff={(result() as Result<string, GitError>).value} />}
</Match>
```

**Verify**: `bun run typecheck` → exit 0

### Step 3: Run tests and lint

**Verify**: `bun test src` → all tests pass
**Verify**: `bun run fix` → exit 0

## Test plan

No new tests required. The change is a presentation-layer fix: error information that was already returned by the git services is now surfaced to the user instead of discarded. The existing test suite confirms no regression.

If you wanted to add a test, it would go in a new `src/component/diff-pane/index.test.tsx`, but component testing infrastructure is not yet established (see plan 013).

## Done criteria

- [ ] `bun run typecheck` exits 0
- [ ] `bun test src` exits 0
- [ ] `bun run fix` exits 0
- [ ] `grep -rn "Result.unwrap" src/component/diff-pane/` returns no matches
- [ ] No files outside `src/component/diff-pane/index.tsx` are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The code at `diff-pane/index.tsx:27-49` doesn't match the excerpts (the codebase has drifted).
- `formatGitError` is not exported from `src/lib/git/errors.ts` — check the barrel in `src/lib/git/index.ts`.
- A type error arises that requires modifying the `GitResult` or `GitError` types (they are correct as-is; re-read them before concluding there's an error).

## Maintenance notes

- If `DiffPane` adds more diff sources in the future, each should return `Result<T, GitError>` rather than unwrapping.
- The `Result` import is already present in `diff-pane/index.tsx:7`. The `formatGitError` and `GitError` imports are new.
