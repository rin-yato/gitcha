# Plan 006: Move chokidar to devDependencies

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 248b1ac..HEAD -- package.json scripts/dev.ts`
> If these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: deps
- **Planned at**: commit `248b1ac`, 2026-06-13

## Why this matters

`chokidar` (~8MB with native binaries) is listed in `dependencies` but only imported in `scripts/dev.ts` — a dev script that is excluded from the published package (see `package.json:27`: `"files": ["dist"]`). Every `bun install` in production unnecessarily downloads and installs chokidar. Moving it to `devDependencies` saves install time and disk space for consumers.

This is also a prerequisite for plan 007 (file watcher), which will import chokidar in production source — at which point chokidar will be moved back to `dependencies`. For now, it belongs in `devDependencies`.

## Current state

- `package.json:63` — `"chokidar": "^5.0.0"` in `dependencies`
- `scripts/dev.ts:5` — `import chokidar from "chokidar"` (only import in codebase)

```json
// package.json (dependencies section)
"dependencies": {
  "chokidar": "^5.0.0",  // only used in scripts/dev.ts (not shipped)
}
```

```json
// package.json (files section)
"files": ["dist"]  // scripts/ not included in published package
```

Confirmation: `rg -l "chokidar" src/` returns no matches. Only `scripts/dev.ts` imports it.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Install   | `bun install`            | exit 0              |
| Build     | `bun run build`          | exit 0              |
| Typecheck | `bun run typecheck`      | exit 0, no errors   |
| Tests     | `bun test src`           | all pass            |

## Scope

**In scope**: `package.json` only (move chokidar entry from `dependencies` to `devDependencies`).

**Out of scope**: `scripts/dev.ts`, `src/`, any other file.

## Git workflow

- Branch: `advisor/006-move-chokidar-to-devdeps`
- Commit message: `chore(deps): move chokidar from dependencies to devDependencies`

## Steps

### Step 1: Update package.json

In `package.json`, remove `"chokidar": "^5.0.0"` from the `dependencies` object and add it to the `devDependencies` object.

### Step 2: Install and verify

Run `bun install` to regenerate `bun.lock`.

**Verify**: `bun run typecheck` → exit 0
**Verify**: `bun test src` → all pass
**Verify**: `bun run build` → exit 0 (confirms build doesn't depend on chokidar)

## Test plan

No new tests needed. The dev script (`bun run dev`) is not run in CI; it's interactive. The build and test scripts confirm the production path doesn't need chokidar.

## Done criteria

- [ ] `chokidar` is in `devDependencies`, not in `dependencies`, in `package.json`
- [ ] `bun run typecheck` exits 0
- [ ] `bun test src` exits 0
- [ ] `bun run build` exits 0
- [ ] Only `package.json` and `bun.lock` are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- `package.json` doesn't match the current state excerpt (e.g., chokidar already moved).
- Any other file imports `chokidar` in `src/`.
- Build fails after the move.

## Maintenance notes

- Plan 007 will move chokidar back to `dependencies` when implementing the file watcher in production code. This plan ensures the move back is intentional and justified.
