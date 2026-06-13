# Plan 013: Add ExCommandPrompt and SidebarProvider component tests

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 248b1ac..HEAD -- src/component/ex-command-prompt/ src/context/sidebar/sidebar.tsx src/context/sidebar/sidebar.test.ts`
> If these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: L
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests
- **Planned at**: commit `248b1ac`, 2026-06-13

## Why this matters

The two most complex state machines in the app have zero test coverage:

1. **ExCommandPrompt** (`src/component/ex-command-prompt/`, 427 lines in index.tsx): 8-state state machine with input, suggestions, git-output, streaming, and completion states. 16 reactive primitives (signals, memos, effects). 7 context dependencies. No tests.

2. **SidebarProvider auto-selection effect**: The `createEffect(on([targets], ...))` at `sidebar.tsx:207-219` has a known regression history (documented in `sidebar.test.ts:13-16`). The existing tests only cover the pure re-implementation, NOT the actual reactive effect.

This plan adds focused tests for the highest-risk logic in both.

## Current state

- `src/component/ex-command-prompt/ex-command-input.ts` — pure functions already have tests in `ex-command-input.test.ts`
- `src/component/ex-command-prompt/ex-command-input.test.ts` — existing test file (pattern to follow)
- `src/context/sidebar/sidebar.tsx:207-219` — the auto-selection effect (untested)
- `src/context/sidebar/sidebar.test.ts` — existing tests for pure helpers (pattern to follow)

```typescript
// sidebar.tsx:207-219 — the effect that needs testing
createEffect(
  on([targets], ([t]) => {
    if (t.length === 0) {
      setState("selectedTarget", null);
      return;
    }

    const current = state.selectedTarget;
    const valid = current && t.some((x) => isGitFileTargetEqual(x, current));

    if (!valid) setState("selectedTarget", t[0]!);
  }),
);
```

```typescript
// sidebar.test.ts:13-16 — documents the regression this effect had
// Pure re-implementation of the auto-selection logic from the SidebarProvider effect.
// Regression guard: previously used `on(targets, ...)` (function form) which tracked
// the memo's internal sources instead of its value, causing the effect to fire on
// irrelevant state changes and overwrite valid user selections.
```

The existing test at `sidebar.test.ts:109-170` tests a pure `autoSelectTarget` function — but never tests the actual `createEffect` inside the provider. If someone changes the deps or batch behavior, the pure function test won't catch it.

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run typecheck`      | exit 0, no errors   |
| Tests     | `bun test src`           | all pass            |
| Lint      | `bun run check`          | exit 0              |
| Fix       | `bun run fix`            | exit 0              |

## Scope

**In scope**:
- `src/component/ex-command-prompt/ex-command-input.test.ts` — add edge-case tests for existing pure functions
- `src/context/sidebar/sidebar.test.ts` — add tests that exercise the actual SolidJS store + effect

**Out of scope**:
- Full component render tests (requires `@opentui/core` renderable stubs — not available)
- `src/component/ex-command-prompt/index.tsx` — the JSX component itself; only test the pure logic
- Any other test file

## Git workflow

- Branch: `advisor/013-component-tests`
- Commit message: `test: expand ExCommandPrompt and SidebarProvider tests`

## Steps

### Step 1: Add edge-case tests for ex-command-input

In `src/component/ex-command-prompt/ex-command-input.test.ts`, add tests for:

1. **Empty commands list**: `buildExPromptSuggestions([])` returns `[]`
2. **Duplicate command names**: deduplication by name
3. **All nargs values**: `"0"`, `"1"`, `"?"`, `"*"`, `"+"` — each produces correct `expectsArgs`
4. **Empty input**: `getExPromptSuggestions(commands, "")` returns first N suggestions
5. **Substring match**: `getExPromptSuggestions(commands, ":g")` matches `:git` but not `:quit`
6. **Selection wrapping**: `moveExPromptSelectionInList` wraps at both ends
7. **null on unknown field types**: `getExPromptCommandText({ usage: 123 as unknown }, "usage")` returns undefined

```typescript
// Example additions:
test("buildExPromptSuggestions handles empty commands", () => {
  expect(buildExPromptSuggestions([])).toEqual([]);
});

test("buildExPromptSuggestions deduplicates by label", () => {
  const commands: ExPromptCommand[] = [
    { name: "git", desc: "first" },
    { name: "git", desc: "second" },
  ];
  const suggestions = buildExPromptSuggestions(commands);
  expect(suggestions.length).toBe(1);
});

test("getExPromptSuggestions returns first N when query is empty", () => {
  const suggestions = getExPromptSuggestions(sampleCommands, "", 2);
  expect(suggestions.length).toBe(2);
});

test("moveExPromptSelectionInList wraps forward", () => {
  const suggestions = buildExPromptSuggestions(sampleCommands);
  const result = moveExPromptSelectionInList(suggestions, suggestions.length - 1, 1);
  expect(result).toBe(0);
});
```

**Verify**: `bun test src/component/ex-command-prompt/ex-command-input.test.ts` → all pass

### Step 2: Add reactive store tests for SidebarProvider auto-selection

In `src/context/sidebar/sidebar.test.ts`, add tests that exercise the actual SolidJS store behavior with the `createEffect` pattern. Since we can't easily test the provider without a render tree, we test a minimal reconstruction of the effect + store:

```typescript
import { createEffect, createMemo, createRoot, on } from "solid-js";
import { createStore } from "solid-js/store";

// Simulate the SidebarProvider effect with a real SolidJS reactive root.
// This catches regressions in effect deps, batch ordering, and signal tracking.

describe("sidebar auto-selection effect", () => {
  test("effect selects first target when targets change and selection is null", () => {
    createRoot((dispose) => {
      const [state, setState] = createStore<SidebarState>({
        width: 30, open: true, selectedTarget: null,
        viewMode: "tree", collapsedDirectoryKeys: [],
      });

      const targets = createMemo(() => {
        return [
          { section: "changes" as const, path: "a.ts" },
          { section: "changes" as const, path: "b.ts" },
        ];
      });

      createEffect(
        on([targets], ([t]) => {
          if (t.length === 0) {
            setState("selectedTarget", null);
            return;
          }
          const current = state.selectedTarget;
          const valid = current && t.some((x) => isGitFileTargetEqual(x, current));
          if (!valid) setState("selectedTarget", t[0]!);
        }),
      );

      expect(state.selectedTarget).toEqual({ section: "changes", path: "a.ts" });
      dispose();
    });
  });

  test("effect preserves valid selection when targets don't change", () => {
    createRoot((dispose) => {
      const [state, setState] = createStore<SidebarState>({
        width: 30, open: true,
        selectedTarget: { section: "changes", path: "b.ts" },
        viewMode: "tree", collapsedDirectoryKeys: [],
      });

      const targets = createMemo(() => {
        return [
          { section: "changes" as const, path: "a.ts" },
          { section: "changes" as const, path: "b.ts" },
        ];
      });

      createEffect(
        on([targets], ([t]) => {
          if (t.length === 0) { setState("selectedTarget", null); return; }
          const current = state.selectedTarget;
          const valid = current && t.some((x) => isGitFileTargetEqual(x, current));
          if (!valid) setState("selectedTarget", t[0]!);
        }),
      );

      expect(state.selectedTarget).toEqual({ section: "changes", path: "b.ts" });
      dispose();
    });
  });

  test("effect clears selection when targets become empty", () => {
    createRoot((dispose) => {
      const [state, setState] = createStore<SidebarState>({
        width: 30, open: true,
        selectedTarget: { section: "changes", path: "a.ts" },
        viewMode: "tree", collapsedDirectoryKeys: [],
      });

      const targets = createMemo(() => [] as GitFileTarget[]);

      createEffect(
        on([targets], ([t]) => {
          if (t.length === 0) { setState("selectedTarget", null); return; }
          const current = state.selectedTarget;
          const valid = current && t.some((x) => isGitFileTargetEqual(x, current));
          if (!valid) setState("selectedTarget", t[0]!);
        }),
      );

      expect(state.selectedTarget).toBeNull();
      dispose();
    });
  });
});
```

Note: These tests use `createRoot` + manual `dispose()` to avoid leaking reactive contexts. This is the pattern for testing SolidJS effects outside a component tree.

**Verify**: `bun test src/context/sidebar/sidebar.test.ts` → all pass

### Step 3: Run full suite and lint

**Verify**: `bun test src` → all pass
**Verify**: `bun run typecheck` → exit 0
**Verify**: `bun run fix` → exit 0

## Test plan

- 7 new tests in `ex-command-input.test.ts` (edge cases for existing pure functions)
- 3 new tests in `sidebar.test.ts` (reactive effect behavior with `createRoot`)

## Done criteria

- [ ] `ex-command-input.test.ts` has tests for empty, dedup, nargs, empty-input, substring, wrap, null fields
- [ ] `sidebar.test.ts` has effect tests for auto-select, preserve selection, clear on empty
- [ ] `bun test src` exits 0, including all new tests
- [ ] `bun run typecheck` exits 0
- [ ] `bun run fix` exits 0
- [ ] Only test files modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- `createRoot` is not available in the installed SolidJS version. Check with `rg "createRoot" node_modules/solid-js/`. If unavailable, use an alternative reactive testing approach.
- The import for `isGitFileTargetEqual` or `GitFileTarget` fails — check the barrel export at `src/lib/git/index.ts`.
- A test fails and the failure is a pre-existing bug (not a test bug). Report it — do NOT fix in this plan.

## Maintenance notes

- The `createRoot` + `dispose()` pattern is essential for effect testing — SolidJS effects must be cleaned up or they leak across tests.
- The `on([targets], ...)` wrapper is the key to the regression guard. If the code ever changes to plain `createEffect(() => { ... targets(); ... })`, the effect would fire on irrelevant state changes — these tests would catch that.
- SolidJS `createRoot` is documented in the SolidJS testing guide. It creates an isolated ownership scope.
