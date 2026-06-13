# Plan 010: Add branch-based review mode

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 248b1ac..HEAD -- src/component/review/mode-select.tsx src/component/review/ src/lib/git/review/ src/lib/git/branch/ src/lib/git/types.ts`
> If these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `248b1ac`, 2026-06-13

## Why this matters

The README (line 9) states: "It supports branch-based diff review, so you can inspect changes the way you would review a PR or MR before merging." But the actual review modes in `mode-select.tsx:8` are only `single-commit` and `base-commit`. There's no "review this branch against main" mode. Users must manually find the merge-base commit and enter "Since Commit" mode. The building blocks are already in place: `GitReviewService.resolveBaseCommitTarget` can handle this if given the right refs, and `GitBranchService` can list branches. This plan adds a "Branch" review mode that auto-computes the merge-base.

## Current state

- `src/component/review/mode-select.tsx` — review mode picker (only 2 modes)
- `src/lib/git/review/service.ts` — `resolveBaseCommitTarget` handles base-commit comparison
- `src/lib/git/branch/` — branch listing service
- `src/lib/git/types.ts:137-149` — `GitReviewTarget` type

```typescript
// mode-select.tsx:8-21
type ReviewMode = "single-commit" | "base-commit";

const MODE_OPTIONS: SelectOption<ReviewMode>[] = [
  { title: "Commit", value: "single-commit", description: "changes in a single commit" },
  { title: "Since Commit", value: "base-commit", description: "changes since a commit" },
];
```

```typescript
// types.ts:137-149 — GitReviewTarget type (no "branch" mode)
export type GitReviewTarget =
  | { mode: "single-commit"; ref: string; label?: string }
  | { mode: "base-commit"; ref: string; compareRef?: string | null; includeUntracked?: boolean; label?: string };
```

```typescript
// review/service.ts:173-206 — resolveBaseCommitTarget already handles the right logic
private async resolveBaseCommitTarget(
  target: Extract<GitReviewTarget, { mode: "base-commit" }>,
  cwd: string | undefined,
): Promise<GitResult<GitReviewResolution>> {
  // validates ref, resolves to commit, handles compareRef
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
- `src/lib/git/types.ts` — add `"branch"` to `GitReviewTarget` discriminated union
- `src/lib/git/review/service.ts` — add `resolveBranchTarget` method
- `src/lib/git/review/command.ts` — no changes needed (existing commands work)
- `src/component/review/mode-select.tsx` — add "Branch" option
- New file: `src/component/review/branch-picker.tsx` — branch selection dialog

**Out of scope**:
- `src/lib/git/executor.ts`
- `src/lib/git/branch/` — the branch service already works; no changes needed
- Keyboard bindings for the new mode — they're auto-derived from the mode list

## Git workflow

- Branch: `advisor/010-branch-review-mode`
- Commit message: `feat(review): add branch-based review mode`

## Steps

### Step 1: Add "branch" to GitReviewTarget

In `src/lib/git/types.ts`, add a new variant to the discriminated union:

```typescript
export type GitReviewTarget =
  | { mode: "single-commit"; ref: string; label?: string }
  | { mode: "base-commit"; ref: string; compareRef?: string | null; includeUntracked?: boolean; label?: string }
  | {
      mode: "branch";
      baseBranch: string;
      targetBranch: string;
      includeUntracked?: boolean;
      label?: string;
    };
```

The `GitCommitReviewMode` type at line 135 should stay as-is — it's used for resolution. The resolution for a branch review reuses the existing `base-commit` resolution types.

**Verify**: `bun run typecheck` → exit 0 (expect errors in `review/service.ts` — that's expected, we fix them next).

### Step 2: Add resolveBranchTarget to GitReviewService

In `src/lib/git/review/service.ts`:

1. In `resolve()` method (line 29), add a branch for the new mode BEFORE `resolveBaseCommitTarget`:

```typescript
async resolve(target: GitReviewTarget): Promise<GitResult<GitReviewResolution>> {
  const cwd = await this.client.getExecutorCwd();

  if (target.mode === "single-commit") {
    return this.resolveSingleCommitTarget(target, cwd);
  }

  if (target.mode === "branch") {
    return this.resolveBranchTarget(target, cwd);
  }

  return this.resolveBaseCommitTarget(target, cwd);
}
```

2. Add the new `resolveBranchTarget` private method at the end of the class:

```typescript
private async resolveBranchTarget(
  target: Extract<GitReviewTarget, { mode: "branch" }>,
  cwd: string | undefined,
): Promise<GitResult<GitReviewResolution>> {
  // Compute merge-base between baseBranch and targetBranch
  const mergeBaseOutput = await this.client.executor.runText(
    ["merge-base", target.baseBranch, target.targetBranch],
    { cwd, dedupe: true },
  );
  if (Result.isError(mergeBaseOutput)) return Result.err(mergeBaseOutput.error);

  const baseRef = mergeBaseOutput.value.trim();
  if (!baseRef) {
    return Result.err(
      new GitRepositoryStateError({
        message: `Could not find merge-base between ${target.baseBranch} and ${target.targetBranch}`,
        operation: "merge-base",
        stderr: "",
      }),
    );
  }

  // Resolve target branch to a commit ref
  const compareRefOutput = await this.client.executor.runText(
    ["rev-parse", "--verify", `${target.targetBranch}^{commit}`],
    { cwd, dedupe: true },
  );
  if (Result.isError(compareRefOutput)) return Result.err(compareRefOutput.error);

  const compareRef = compareRefOutput.value.trim();
  if (!compareRef) {
    return Result.err(
      new GitRepositoryStateError({
        message: `Branch not found: ${target.targetBranch}`,
        operation: "rev-parse --verify",
        stderr: "",
      }),
    );
  }

  const baseLabel = target.label ?? `${target.targetBranch} vs ${target.baseBranch}`;

  return Result.ok({
    mode: "base-commit",
    baseRef,
    compareRef,
    targetRef: compareRef,
    revisionRange: `${baseRef}..${compareRef}`,
    baseLabel,
    isRootCommit: false,
    includeUntracked: target.includeUntracked ?? true,
  });
}
```

**Verify**: `bun run typecheck` → exit 0

### Step 3: Add Branch option to mode-select

In `src/component/review/mode-select.tsx`:

1. Change `ReviewMode` to include `"branch"`:

```typescript
type ReviewMode = "single-commit" | "base-commit" | "branch";
```

2. Add a third option:

```typescript
{
  title: "Branch",
  value: "branch",
  description: "changes on a branch compared to another",
},
```

3. Update the `onSelect` handler to show a branch picker for the new mode:

```typescript
onSelect={(option) => {
  if (option.value === "branch") {
    dialog.show({
      component: () => <BranchPicker />,
    });
    return;
  }
  dialog.show({
    component: () => <CommitPicker mode={option.value} />,
  });
}}
```

**Verify**: `bun run typecheck` → exit 0 (expect error about missing `BranchPicker` — fixed next step).

### Step 4: Create branch picker component

Create `src/component/review/branch-picker.tsx`. Model it after `CommitPicker` but for branch selection. It should:
1. Load branch list using `git.branch.list()`.
2. Present a `Select` dialog for the target branch.
3. Use `"main"` or the repo's default branch as the base branch (you can get the current branch from `git.status.get()` for the default base).
4. On selection, call `review.start({ mode: "branch", baseBranch: "...", targetBranch: selectedBranch.name })`.

For a minimal implementation (since the user may want to also pick the base branch), a simpler approach: use the current branch as the target and main as the base, or offer branch selection:

```typescript
import { createResource } from "solid-js";
import { Select } from "@/component/ui/select";
import type { SelectOption } from "@/component/ui/select/types";
import { git } from "@/lib/git";
import type { GitBranch } from "@/lib/git";
import { useDialog } from "@/context/dialog";
import { useReview } from "@/context/review";
import { useTheme } from "@/context/theme";
import { Result } from "better-result";

export function BranchPicker() {
  const dialog = useDialog();
  const review = useReview();
  const theme = useTheme();

  const [branches] = createResource(
    async () => {
      const result = await git.branch.list();
      if (Result.isError(result)) return [];
      return result.value;
    },
  );

  const options = () => {
    const list = branches() ?? [];
    return list.map((b): SelectOption<GitBranch> => ({
      title: b.name,
      value: b,
      description: b.current ? "(current)" : undefined,
    }));
  };

  return (
    <box width={50} backgroundColor={theme.state.token.surface} padding={1}>
      <Select
        title="Target Branch"
        options={options()}
        skipFilter
        onClose={() => dialog.close()}
        onSelect={(option) => {
          review.start({
            mode: "branch",
            baseBranch: "main",
            targetBranch: option.value.name,
            label: `${option.value.name} vs main`,
          });
          dialog.close();
        }}
      />
    </box>
  );
}
```

Note: If `git.branch.list` doesn't exist or has a different API, check `src/lib/git/branch/` for the correct import and adjust.

**Verify**: `bun run typecheck` → exit 0

### Step 5: Run tests and lint

**Verify**: `bun test src` → all pass
**Verify**: `bun run fix` → exit 0

## Test plan

- Add a test for `resolveBranchTarget` to the existing review service test (or create `src/lib/git/review/service.test.ts` if it doesn't exist). Test that it computes merge-base correctly with a mock executor.

Since creating a full mock infrastructure is out of scope, the minimum test is a pure-function test of the resolution logic. If that's too heavy for this plan, the manual test is: run `gitcha` in a repo, press `v`, select "Branch", pick a branch, and verify the diff shows correctly.

## Done criteria

- [ ] `"branch"` mode added to `GitReviewTarget`
- [ ] `resolveBranchTarget` added to `GitReviewService.resolve()`
- [ ] "Branch" option in mode-select with branch picker
- [ ] `bun run typecheck` exits 0
- [ ] `bun test src` exits 0
- [ ] `bun run fix` exits 0
- [ ] Only files in "In scope" are modified/created
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- `git.branch.list()` doesn't exist or has a different signature. Check `src/lib/git/branch/index.ts` for the exported API.
- Adding `"branch"` to `GitReviewTarget` causes widespread type errors because other code exhaustively checks the union. Use `rg "GitReviewTarget" src/` to find all references.
- The `CommitPicker` component doesn't exist or has a different import path (check `src/component/review/commit-picker.tsx`).

## Maintenance notes

- The base branch defaults to `"main"`. A future improvement would auto-detect the repo's default branch via `git symbolic-ref refs/remotes/origin/HEAD`.
- The `resolveBranchTarget` returns a `GitReviewResolution` with `mode: "base-commit"` — the resolution is semantically a base-commit comparison; the `GitReviewTarget` is the only thing with `mode: "branch"`.
- If `GitBranchService.list()` is not already imported in the barrel, add it to `src/lib/git/index.ts`.
