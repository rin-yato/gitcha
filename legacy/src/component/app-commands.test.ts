import { describe, expect, test } from "bun:test";

import { createDefaultAppConfig } from "@/lib/config";

import { buildCommandOptions, buildCommandSelectOptions } from "./app-commands";

describe("buildCommandOptions", () => {
  test("includes status command", () => {
    const config = createDefaultAppConfig();
    const commands = buildCommandOptions({
      refresh: () => {},
      showCompareBranchDialog: () => {},
      showThemeDialog: () => {},
      showStatusDialog: () => {},
      keybindings: config.keybindings,
      app: {
        toggleDiffViewMode: () => {},
        exitCompareMode: () => {},
        stageSelectedFile: () => {},
        unstageSelectedFile: () => {},
        discardSelectedFile: () => {},
        shrinkSidebar: () => {},
        growSidebar: () => {},
        toggleSidebar: () => {},
        openConfigFile: () => {},
        upgradeApp: () => {},
      },
    });

    expect(commands.some((command) => command.id === "status")).toBe(true);
    expect(commands.find((command) => command.id === "refresh")?.slash).toBe("r");
  });

  test("does not duplicate suggested commands", () => {
    const options = buildCommandSelectOptions([
      { id: "refresh", label: "Refresh", category: "Action", run: () => {} },
      { id: "status", label: "Status", category: "View", run: () => {} },
    ]);

    const titles = options.map((option) => option.title);
    expect(titles.filter((title) => title === "Refresh")).toHaveLength(1);
    expect(titles.filter((title) => title === "Status")).toHaveLength(1);
  });
});
