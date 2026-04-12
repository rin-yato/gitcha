import { describe, expect, test } from "bun:test";

import type { GitStatusFile } from "@/lib/git";
import { buildFileTree } from "@/lib/git";

import {
  buildFileKey,
  getAncestorDirs,
  getFileStatus,
  parseFileKey,
  splitPath,
  truncateDir,
} from "./utils";

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

  describe("getAncestorDirs", () => {
    test("returns empty array for root-level files", () => {
      expect(getAncestorDirs("README.md")).toEqual([]);
    });

    test("returns parent dir for single-level paths", () => {
      expect(getAncestorDirs("src/app.ts")).toEqual(["src"]);
    });

    test("returns all ancestor dirs for deeply nested paths", () => {
      expect(getAncestorDirs("src/components/ui/button.ts")).toEqual([
        "src",
        "src/components",
        "src/components/ui",
      ]);
    });
  });

  describe("buildFileTree (sidebar integration)", () => {
    test("flat root-level files produce no directory nodes", () => {
      const files: GitStatusFile[] = [
        { path: "README.md", indexStatus: "A", workingTreeStatus: " " },
        { path: "tsconfig.json", indexStatus: "M", workingTreeStatus: " " },
      ];
      const { children } = buildFileTree(files);
      expect(children.every((n) => !n.isDirectory)).toBe(true);
      expect(children.map((n) => n.name)).toEqual(["README.md", "tsconfig.json"]);
    });

    test("groups files under their parent directory", () => {
      const files: GitStatusFile[] = [
        { path: "src/app.ts", indexStatus: "M", workingTreeStatus: " " },
        { path: "src/index.ts", indexStatus: "A", workingTreeStatus: " " },
      ];
      const { children } = buildFileTree(files);
      expect(children).toHaveLength(1);
      const srcDir = children[0]!;
      expect(srcDir.isDirectory).toBe(true);
      expect(srcDir.name).toBe("src");
      expect(srcDir.children.map((n) => n.name)).toEqual(["app.ts", "index.ts"]);
    });
  });
});
