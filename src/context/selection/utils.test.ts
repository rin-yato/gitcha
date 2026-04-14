import { describe, expect, test } from "bun:test";

import type { GitStatusFile } from "@/lib/git";

import {
  buildFileKey,
  clampIndex,
  fileAtIndex,
  fileKeyFromIndex,
  indexOfFile,
  parseFileKey,
} from "./utils";

const file = (path: string): GitStatusFile => ({
  path,
  indexStatus: " ",
  workingTreeStatus: "M",
});

describe("fileKeyFromIndex", () => {
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

  test("returns null when no files", () => {
    expect(fileKeyFromIndex([], 0, 0, "staging")).toBeNull();
  });

  test("returns a key for a valid index", () => {
    const files = [file("a.ts"), file("b.ts")];
    expect(fileKeyFromIndex(files, 1, 1, "staging")).toBe("changes:b.ts");
  });

  test("returns compare key in compare mode", () => {
    const files = [file("a.ts"), file("b.ts")];
    expect(fileKeyFromIndex(files, 0, 0, "compare")).toBe("compare:a.ts");
    expect(fileKeyFromIndex(files, 1, 0, "compare")).toBe("compare:b.ts");
  });
});

describe("fileAtIndex", () => {
  test("returns null for out-of-range", () => {
    expect(fileAtIndex([], 5)).toBeNull();
    expect(fileAtIndex([file("a.ts")], 5)).toBeNull();
  });

  test("returns the file at the given index", () => {
    const files = [file("a.ts"), file("b.ts")];
    expect(fileAtIndex(files, 0)?.path).toBe("a.ts");
    expect(fileAtIndex(files, 1)?.path).toBe("b.ts");
  });
});

describe("clampIndex", () => {
  test("returns 0 for empty files", () => {
    expect(clampIndex(5, 0)).toBe(0);
  });

  test("clamps to max index", () => {
    expect(clampIndex(10, 3)).toBe(2);
  });

  test("clamps to 0", () => {
    expect(clampIndex(-1, 3)).toBe(0);
  });
});

describe("indexOfFile", () => {
  test("finds a file by path", () => {
    const files = [file("a.ts"), file("b.ts")];
    expect(indexOfFile(files, "b.ts")).toBe(1);
  });
});
