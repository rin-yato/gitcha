import { describe, expect, test } from "bun:test";

import type { GitStatusFile } from "@/lib/git";

import { buildFileKey, getFileStatus, parseFileKey, splitPath, truncateDir } from "./utils";

describe("sidebar utils", () => {
  test("getFileStatus prefers working tree status", () => {
    const file = { path: "a.ts", indexStatus: "A", workingTreeStatus: "M" } as GitStatusFile;
    expect(getFileStatus(file)).toBe("M");
  });

  test("getFileStatus falls back to index status", () => {
    const file = { path: "a.ts", indexStatus: "A", workingTreeStatus: " " } as GitStatusFile;
    expect(getFileStatus(file)).toBe("A");
  });

  test("splitPath returns name and dir", () => {
    expect(splitPath("src/component/file.ts")).toEqual({
      name: "file.ts",
      dir: "src/component",
    });
    expect(splitPath("file.ts")).toEqual({ name: "file.ts", dir: null });
  });

  test("buildFileKey includes section", () => {
    expect(buildFileKey("changes", "src/app.ts")).toBe("changes:src/app.ts");
  });

  test("parseFileKey round trips valid keys", () => {
    expect(parseFileKey("staged:src/app.ts")).toEqual({
      section: "staged",
      path: "src/app.ts",
    });
  });

  test("parseFileKey rejects invalid keys", () => {
    expect(parseFileKey("badkey")).toBeNull();
    expect(parseFileKey("other:src/app.ts")).toBeNull();
  });

  test("truncateDir keeps short paths unchanged", () => {
    expect(truncateDir("src/sidebar", 20)).toBe("src/sidebar");
  });

  test("truncateDir keeps last segment only when short", () => {
    expect(truncateDir("src/component/sidebar", 12)).toBe("…/sidebar");
  });

  test("truncateDir handles deep paths cleanly", () => {
    expect(truncateDir("project-name/frontend/src/component/sidebar", 18)).toBe("…/sidebar");
  });

  test("truncateDir keeps first and last segment when possible", () => {
    expect(truncateDir("src/frontend/component/sidebar", 20)).toBe("src/…/sidebar");
  });
});
