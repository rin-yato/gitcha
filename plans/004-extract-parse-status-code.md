# Plan 004: Extract duplicate parseStatusCode to shared module

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 248b1ac..HEAD -- src/lib/git/status/parser.ts src/lib/git/diff/parser.ts`
> If these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `248b1ac`, 2026-06-13

## Why this matters

`parseStatusCode` is defined identically in two places: `src/lib/git/status/parser.ts:39-41` and `src/lib/git/diff/parser.ts:8-10`. A fix to status-code handling (e.g., git adding a new porcelain status code) would need to be made in both places. The copies are mechanically identical today but will drift over time.

## Current state

- `src/lib/git/status/parser.ts:39-41`
- `src/lib/git/diff/parser.ts:8-10`

```typescript
// status/parser.ts:39-41
function parseStatusCode(value: string | undefined): GitFileStatus {
  return (value || " ") as GitFileStatus;
}

// diff/parser.ts:8-10
function parseStatusCode(value: string | undefined): GitFileStatus {
  return (value || " ") as GitFileStatus;
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

**In scope**:
- Create `src/lib/git/status-code.ts` (new file)
- Edit `src/lib/git/status/parser.ts` — remove local definition, import from shared
- Edit `src/lib/git/diff/parser.ts` — remove local definition, import from shared

**Out of scope**: Any other file. Do not refactor `parseStatusCode` behavior — extraction only.

## Git workflow

- Branch: `advisor/004-extract-parse-status-code`
- Commit message: `refactor(git): extract duplicate parseStatusCode to shared module`

## Steps

### Step 1: Create shared module

Create `src/lib/git/status-code.ts`:

```typescript
import type { GitFileStatus } from "./types";

export function parseStatusCode(value: string | undefined): GitFileStatus {
  return (value || " ") as GitFileStatus;
}
```

**Verify**: `ls src/lib/git/status-code.ts` → file exists

### Step 2: Update status/parser.ts

In `src/lib/git/status/parser.ts`:
1. Remove lines 39-41 (the local `parseStatusCode`).
2. Add import: `import { parseStatusCode } from "./status-code";` (relative path since both are in `src/lib/git/`).

**Verify**: `bun run typecheck` → exit 0

### Step 3: Update diff/parser.ts

In `src/lib/git/diff/parser.ts`:
1. Remove lines 8-10 (the local `parseStatusCode`).
2. Add import: `import { parseStatusCode } from "../status-code";`

**Verify**: `bun run typecheck` → exit 0
**Verify**: `grep -n "function parseStatusCode" src/lib/git/status/parser.ts src/lib/git/diff/parser.ts` → only the new file should have a definition; status/parser and diff/parser should only have `import` references.

### Step 4: Run tests and lint

**Verify**: `bun test src` → all pass
**Verify**: `bun run fix` → exit 0

## Test plan

No new tests — extraction is purely mechanical. Existing parser tests continue to cover the function through both call sites.

## Done criteria

- [ ] `src/lib/git/status-code.ts` exists with the shared function
- [ ] `bun run typecheck` exits 0
- [ ] `bun test src` exits 0, all existing tests pass
- [ ] `bun run fix` exits 0
- [ ] Only files listed in "In scope" are modified + the new status-code.ts file created
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- Either parser file doesn't match the excerpts.
- Any test in `src/lib/git/status/parser.test.ts` or `src/lib/git/diff/parser.test.ts` fails.
- The import path resolution fails — check `tsconfig.json` paths; these are relative imports within `src/lib/git/` so no alias needed.

## Maintenance notes

- If git ever adds a new porcelain status code, update `GitFileStatus` in `types.ts` and the guard (if one is added later) in `status-code.ts`.
- This module is the right place for a future type guard `isGitFileStatus(value: string): value is GitFileStatus`.
