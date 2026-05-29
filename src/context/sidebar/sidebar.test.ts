import { describe, expect, test } from "bun:test";

import { batch } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
import { createStore } from "solid-js/store";

import type { GitFileTarget } from "@/lib/git";
import { isGitFileTargetEqual } from "@/lib/git";

import type { SidebarState } from "./sidebar";
import { createSidebarDirectoryKey, isSidebarDirectoryKeyForTarget } from "./sidebar-key";

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
});
