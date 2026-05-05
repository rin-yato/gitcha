import { describe, expect, test } from "bun:test";

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createDefaultAppConfig,
  getAppConfigPath,
  loadAppConfig,
  matchesAnyShortcut,
  normalizeThemeId,
  resolveAppConfig,
  saveAppConfig,
  serializeAppConfig,
} from "./config";

describe("config", () => {
  test("returns the expected default config", () => {
    const config = createDefaultAppConfig();

    expect(config.themeId).toBe("opencode");
    expect(config.sidebarWidth).toBe(40);
    expect(config.padding).toEqual([0, 0, 0, 0]);
    expect(config.keybindings.openCommandPalette).toEqual(["/"]);
  });

  test("resolves config files with fallbacks", () => {
    const config = resolveAppConfig({
      themeId: "unknown",
      sidebarWidth: 12,
      padding: [2, 3, 4, 5],
      keybindings: { refresh: "ctrl+r" },
    });

    expect(config.themeId).toBe("opencode");
    expect(config.sidebarWidth).toBe(20);
    expect(config.padding).toEqual([2, 3, 4, 5]);
    expect(config.keybindings.refresh).toEqual(["ctrl+r"]);
  });

  test("falls back to default padding for invalid values", () => {
    const config = resolveAppConfig({ padding: [1, 2, 3] });

    expect(config.padding).toEqual([0, 0, 0, 0]);
  });

  test("normalizes theme ids", () => {
    expect(normalizeThemeId("opencode-light")).toBe("opencode");
  });

  test("builds the config path under .config/gitcha", () => {
    expect(getAppConfigPath("/Users/me")).toBe("/Users/me/.config/gitcha/gitcha.json");
  });

  test("matches any shortcut against keyboard events", () => {
    expect(matchesAnyShortcut({ name: "r" }, ["r", "g"])).toBe(true);
    expect(matchesAnyShortcut({ name: "r" }, ["g"])).toBe(false);
  });

  test("creates a missing config file on load", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gitcha-config-"));
    const path = join(dir, "gitcha.json");

    const config = await loadAppConfig({ path });

    expect(config.themeId).toBe("opencode");
    expect(readFileSync(path, "utf8")).toContain('"$schema"');
    expect(readFileSync(path, "utf8")).toContain('"themeId": "opencode"');

    rmSync(dir, { recursive: true, force: true });
  });

  test("saves config files to disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gitcha-config-"));
    const path = join(dir, "gitcha.json");

    const config = createDefaultAppConfig();
    config.sidebarWidth = 48;
    config.padding = [1, 2, 3, 4];

    await saveAppConfig(config, { path });

    expect(readFileSync(path, "utf8")).toContain('"sidebarWidth": 48');
    expect(readFileSync(path, "utf8")).toContain(
      '"padding": [\n    1,\n    2,\n    3,\n    4\n  ]',
    );

    rmSync(dir, { recursive: true, force: true });
  });

  test("serializes config with schema reference", () => {
    const json = serializeAppConfig(createDefaultAppConfig());

    expect(json).toContain('"$schema"');
    expect(json).toContain('"sidebarWidth": 40');
    expect(json).toContain('"padding": [\n    0,\n    0,\n    0,\n    0\n  ]');
  });
});
