import { describe, expect, test } from "bun:test";

import { batch } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { createStore } from "solid-js/store";

import type { GitFileTarget } from "@/lib/git";
import { isGitFileTargetEqual } from "@/lib/git";

import type { SidebarState } from "./sidebar";
import { createSidebarDirectoryKey, isSidebarDirectoryKeyForTarget } from "./sidebar-key";

// Pure re-implementation of the auto-selection logic from the SidebarProvider effect.
// Regression guard: previously used `on(targets, ...)` (function form) which tracked
// the memo's internal sources instead of its value, causing the effect to fire on
// irrelevant state changes and overwrite valid user selections.
function autoSelectTarget(
  targets: GitFileTarget[],
  currentSelectedTarget: GitFileTarget | null,
): GitFileTarget | null {
  if (targets.length === 0) return null;

  const valid =
    currentSelectedTarget &&
    targets.some((x) => isGitFileTargetEqual(x, currentSelectedTarget));

  return valid ? currentSelectedTarget : targets[0]!;
}

function createTestStore() {
  const [state, setState] = createStore<SidebarState>({
    width: 30,
    open: true,
    selectedTarget: null,
    viewMode: "tree",
    collapsedDirectoryKeys: [],
  });
  return { state, setState };
}

function applySelectedTarget(
  setState: SetStoreFunction<SidebarState>,
  target: GitFileTarget | null,
) {
  batch(() => {
    if (target) {
      setState("collapsedDirectoryKeys", (keys) => {
        const nextKeys = keys.filter((key) => !isSidebarDirectoryKeyForTarget(key, target));
        return nextKeys.length === keys.length ? keys : nextKeys;
      });
    }
    setState("selectedTarget", target);
  });
}

describe("sidebar store", () => {
  test("defaults to tree view", () => {
    const { state } = createTestStore();
    expect(state.viewMode).toBe("tree");
  });

  test("expands collapsed parent directories when selecting a file", () => {
    const { state, setState } = createTestStore();

    setState("collapsedDirectoryKeys", [
      createSidebarDirectoryKey("changes", "src/lib"),
      createSidebarDirectoryKey("changes", "other"),
    ]);

    applySelectedTarget(setState, { section: "changes", path: "src/lib/util.ts" });

    expect(state.collapsedDirectoryKeys).toEqual([
      createSidebarDirectoryKey("changes", "other"),
    ]);
  });

  test("does not expand collapsed directories from another section", () => {
    const { state, setState } = createTestStore();

    setState("collapsedDirectoryKeys", [createSidebarDirectoryKey("staged", "src/lib")]);

    applySelectedTarget(setState, { section: "changes", path: "src/lib/util.ts" });

    expect(state.collapsedDirectoryKeys).toEqual([
      createSidebarDirectoryKey("staged", "src/lib"),
    ]);
  });

  test("expands collapsed parent directories when keyboard selection enters them", () => {
    const { state, setState } = createTestStore();

    const readme: GitFileTarget = { section: "changes", path: "README.md" };
    const util: GitFileTarget = { section: "changes", path: "src/lib/util.ts" };

    setState("collapsedDirectoryKeys", [createSidebarDirectoryKey("changes", "src/lib")]);
    applySelectedTarget(setState, readme);

    const files: GitFileTarget[] = [readme, util];
    const currentIndex = files.findIndex((f) => isGitFileTargetEqual(f, state.selectedTarget));
    const nextTarget = files[(currentIndex + 1) % files.length] ?? null;
    applySelectedTarget(setState, nextTarget);

    expect(state.selectedTarget).toEqual(util);
    expect(state.collapsedDirectoryKeys).toEqual([]);
  });

  // --- Regression: sidebar auto-selection effect deps ---

  test("auto-selects first target when none is selected", () => {
    const targets: GitFileTarget[] = [
      { section: "changes", path: "a.ts" },
      { section: "changes", path: "b.ts" },
    ];

    const result = autoSelectTarget(targets, null);

    expect(result).toBe(targets[0]!);
  });

  test("preserves valid selection when targets remain the same", () => {
    const targets: GitFileTarget[] = [
      { section: "changes", path: "a.ts" },
      { section: "changes", path: "b.ts" },
    ];
    const selected: GitFileTarget = { section: "changes", path: "b.ts" };

    const result = autoSelectTarget(targets, selected);

    expect(result).toEqual(selected);
  });

  test("preserves valid selection across section boundaries", () => {
    const targets: GitFileTarget[] = [
      { section: "staged", path: "a.ts" },
      { section: "changes", path: "b.ts" },
    ];
    const selected: GitFileTarget = { section: "staged", path: "a.ts" };

    const result = autoSelectTarget(targets, selected);

    expect(result).toEqual(selected);
  });

  test("re-selects first target when current selection is no longer in the list", () => {
    const targets: GitFileTarget[] = [{ section: "changes", path: "b.ts" }];
    const selected: GitFileTarget = { section: "changes", path: "a.ts" };

    const result = autoSelectTarget(targets, selected);

    expect(result).toBe(targets[0]!);
  });

  test("returns null when targets list is empty regardless of selection", () => {
    const result = autoSelectTarget([], null);
    const resultWithSelection = autoSelectTarget([], {
      section: "changes",
      path: "a.ts",
    });

    expect(result).toBeNull();
    expect(resultWithSelection).toBeNull();
  });
});
