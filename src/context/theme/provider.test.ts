import { describe, expect, test } from "bun:test";

import opencodeThemeJson from "@/themes/opencode.json";
import type { DesktopTheme } from "@/themes/types";

import { resolveTheme } from "./provider";

describe("resolveTheme", () => {
  test("maps desktop theme json into app theme tokens", () => {
    const theme = resolveTheme(opencodeThemeJson as DesktopTheme, "light");

    expect(theme.background).toBe("#ffffff");
    expect(theme.surface).toBe("#ffffff");
    expect(theme.text).toBe("#1a1a1a");
    expect(theme.accent).toBe("#3b7dd8");
    expect(theme.syntaxComment).toBe("#8a8a8a");
    expect(theme.syntaxFunction).toBe("#3b7dd8");
  });
});
