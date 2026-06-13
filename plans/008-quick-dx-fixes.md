# Plan 008: Quick DX fixes — which placeholder, stale console.log, dead store.ts

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 248b1ac..HEAD -- src/lib/cli.ts src/component/ui/select/index.tsx src/lib/store.ts biome.json`
> If these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `248b1ac`, 2026-06-13

## Why this matters

Three small, independent DX improvements:

1. **`:which` CLI command** (`src/lib/cli.ts:52-56`) prints `"which placeholder"` — a dead placeholder. The help text advertises it as `"Show the current target"`, misleading users.
2. **Stale debug log** (`src/component/ui/select/index.tsx:300`) prints `console.log("rendering group", row)` on every select group render, polluting TUI output.
3. **Dead zero-byte file** `src/lib/store.ts` and the `@/store/**` import grouping in `biome.json:22` reference a store layer that was abandoned.

## Current state

- `src/lib/cli.ts:10-11, 52-56`
- `src/component/ui/select/index.tsx:300`
- `src/lib/store.ts` (zero bytes)
- `biome.json:22` (import group `@/store/**`)

```typescript
// cli.ts:10-11 — help text
    which    Show the current target

// cli.ts:52-56 — implementation
  if (cli.command === COMMANDS.which) {
    return handle(async () => {
      console.log("which placeholder");
    });
  }
```

```typescript
// select/index.tsx:299-301
            {(row, index) => {
              if (row.kind === "group") {
                console.log("rendering group", row);
```

```json
// biome.json:22 (import groups section)
"@/store/**",
```

```bash
$ ls -la src/lib/store.ts
-rw-r--r-- 0 ... src/lib/store.ts  # empty file
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
- `src/lib/cli.ts` — remove `which` command and its help text entry
- `src/component/ui/select/index.tsx` — remove stale `console.log`
- `src/lib/store.ts` — delete the file
- `biome.json` — remove `@/store/**` import group

**Out of scope**: Any other file. Do not implement the `which` command — remove it.

## Git workflow

- Branch: `advisor/008-quick-dx-fixes`
- Commit: three separate commits or one combined; message: `chore: quick DX fixes (which placeholder, console.log, dead store.ts)`

## Steps

### Step 1: Remove `which` command

In `src/lib/cli.ts`:
1. Remove `which` from the `COMMANDS` object (line 15).
2. Remove the `handle` block for `which` (lines 52-56).
3. Remove the `which` line from `HELP_TEXT` (line 10).

**Verify**: `grep -n "which" src/lib/cli.ts` → no matches.

### Step 2: Remove stale console.log

In `src/component/ui/select/index.tsx`, delete line 300: `console.log("rendering group", row);`.

**Verify**: `grep -rn "console.log" src/` → returns only `src/lib/cli.ts` if any remain (the `which` placeholder was there too, so after step 1 there should be zero `console.log` calls in `src/`).

### Step 3: Delete dead store.ts

Delete the file `src/lib/store.ts`.

**Verify**: `ls src/lib/store.ts` → file does not exist.

### Step 4: Remove @/store/** import group

In `biome.json`, remove the `@/store/**` block (around line 22) from the `organizeImports.groups` array.

**Verify**: `grep -n "@/store" biome.json` → no matches.

### Step 5: Verify

**Verify**: `bun run typecheck` → exit 0
**Verify**: `bun test src` → all pass
**Verify**: `bun run fix` → exit 0

## Test plan

No new tests needed. All changes are deletions of dead code or logging.

## Done criteria

- [ ] `which` command removed from `cli.ts` and help text
- [ ] `console.log("rendering group", row)` removed from `select/index.tsx`
- [ ] `src/lib/store.ts` deleted
- [ ] `@/store/**` removed from `biome.json` import groups
- [ ] `bun run typecheck` exits 0
- [ ] `bun test src` exits 0
- [ ] `bun run fix` exits 0
- [ ] No `console.log` calls remain in `src/`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- Any file doesn't match its excerpt (code drifted).
- Removing `which` from `COMMANDS` causes a type error because something else references it — search the codebase: `rg "which" src/` before deleting.
- Deleting `src/lib/store.ts` fails because another file imports from it — check: `rg "@lib/store" src/` or `rg "@/lib/store" src/`.

## Maintenance notes

- The `which` command may be re-implemented in the future to show the current review target. Re-add it then with a real implementation.
- Empty files like `store.ts` should be caught by the lint step (Biome flags empty files). The CI check confirms this.
