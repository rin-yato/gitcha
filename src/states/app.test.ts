import type { GitStatusFile } from "../git";
import {
  buildFileKey,
  clampFocusIndex,
  focusedFileFromIndex,
  focusedFileKey,
  indexOfFile,
  nextFocusIndex,
  selectedFileKey,
} from "./app";
import { describe, expect, test } from "bun:test";

const file = (path: string): GitStatusFile => ({
  path,
  indexStatus: " ",
  workingTreeStatus: "M",
});

describe("buildFileKey", () => {
  test("builds a key from section and path", () => {
    expect(buildFileKey("staged", "src/app.ts")).toBe("staged:src/app.ts");
    expect(buildFileKey("changes", "README.md")).toBe("changes:README.md");
  });
});

describe("selectedFileKey", () => {
  test("returns null when incomplete", () => {
    expect(selectedFileKey(null, "changes")).toBeNull();
    expect(selectedFileKey("a.ts", null)).toBeNull();
  });

  test("returns a key when both are set", () => {
    expect(selectedFileKey("a.ts", "changes")).toBe("changes:a.ts");
    expect(selectedFileKey("b.ts", "staged")).toBe("staged:b.ts");
  });
});

describe("focusedFileKey", () => {
  test("returns null when no files", () => {
    expect(focusedFileKey([], 0, 0)).toBeNull();
  });

  test("returns a key for a valid index", () => {
    const files = [file("a.ts"), file("b.ts")];
    // stagedCount=1 means index 0 is staged, index 1 is changes
    expect(focusedFileKey(files, 1, 1)).toBe("changes:b.ts");
  });

  test("returns staged key when in staged range", () => {
    const files = [file("a.ts"), file("b.ts")];
    expect(focusedFileKey(files, 0, 2)).toBe("staged:a.ts");
  });
});

describe("focusedFileFromIndex", () => {
  test("returns null for out-of-range", () => {
    expect(focusedFileFromIndex([], 5)).toBeNull();
    expect(focusedFileFromIndex([file("a.ts")], 5)).toBeNull();
  });

  test("returns the file at the given index", () => {
    const files = [file("a.ts"), file("b.ts")];
    expect(focusedFileFromIndex(files, 0)?.path).toBe("a.ts");
    expect(focusedFileFromIndex(files, 1)?.path).toBe("b.ts");
  });
});

describe("clampFocusIndex", () => {
  test("returns 0 for empty files", () => {
    expect(clampFocusIndex(5, 0)).toBe(0);
  });

  test("clamps to max index", () => {
    expect(clampFocusIndex(10, 3)).toBe(2);
  });

  test("clamps to 0", () => {
    expect(clampFocusIndex(-1, 3)).toBe(0);
  });

  test("allows valid indices", () => {
    expect(clampFocusIndex(0, 5)).toBe(0);
    expect(clampFocusIndex(2, 5)).toBe(2);
    expect(clampFocusIndex(4, 5)).toBe(4);
  });
});

describe("nextFocusIndex", () => {
  test("moves forward", () => {
    expect(nextFocusIndex(0, 1, 5)).toBe(1);
  });

  test("moves backward", () => {
    expect(nextFocusIndex(2, -1, 5)).toBe(1);
  });

  test("does not go below 0", () => {
    expect(nextFocusIndex(0, -1, 5)).toBe(0);
  });

  test("does not go above fileCount - 1", () => {
    expect(nextFocusIndex(4, 1, 5)).toBe(4);
  });
});

describe("indexOfFile", () => {
  test("finds a file by path", () => {
    const files = [file("a.ts"), file("b.ts")];
    expect(indexOfFile(files, "b.ts")).toBe(1);
  });

  test("returns -1 for missing file", () => {
    expect(indexOfFile([], "missing.ts")).toBe(-1);
    expect(indexOfFile([file("a.ts")], "missing.ts")).toBe(-1);
  });
});
