import { afterEach, describe, expect, test } from "bun:test";

import { $sidebar } from "./sidebar.store";
import { createSidebarDirectoryKey } from "./sidebar-key";

afterEach(() => {
  $sidebar.action.setSelectedTarget(null);
  $sidebar.action.setCollapsedDirectoryKeys([]);
});

describe("sidebar store", () => {
  test("defaults to tree view", () => {
    expect($sidebar.viewMode).toBe("tree");
  });

  test("expands collapsed parent directories when selecting a file", () => {
    $sidebar.action.setCollapsedDirectoryKeys([
      createSidebarDirectoryKey("changes", "src/lib"),
      createSidebarDirectoryKey("changes", "other"),
    ]);

    $sidebar.action.setSelectedTarget({ section: "changes", path: "src/lib/util.ts" });

    expect($sidebar.collapsedDirectoryKeys).toEqual([
      createSidebarDirectoryKey("changes", "other"),
    ]);
  });

  test("does not expand collapsed directories from another section", () => {
    $sidebar.action.setCollapsedDirectoryKeys([createSidebarDirectoryKey("staged", "src/lib")]);

    $sidebar.action.setSelectedTarget({ section: "changes", path: "src/lib/util.ts" });

    expect($sidebar.collapsedDirectoryKeys).toEqual([
      createSidebarDirectoryKey("staged", "src/lib"),
    ]);
  });

  test("expands collapsed parent directories when keyboard selection enters them", () => {
    $sidebar.action.setSelectedTarget({ section: "changes", path: "README.md" });
    $sidebar.action.setCollapsedDirectoryKeys([
      createSidebarDirectoryKey("changes", "src/lib"),
    ]);

    $sidebar.action.selectNext([
      { section: "changes", path: "README.md" },
      { section: "changes", path: "src/lib/util.ts" },
    ]);

    expect($sidebar.selectedTarget).toEqual({ section: "changes", path: "src/lib/util.ts" });
    expect($sidebar.collapsedDirectoryKeys).toEqual([]);
  });
});
