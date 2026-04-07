import type { GitStatusFile } from "../../git";
import { buildFileKey, clampIndex, fileAtIndex, fileKeyFromIndex, indexOfFile } from "./state";
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

describe("fileKeyFromIndex", () => {
  test("returns null when no files", () => {
    expect(fileKeyFromIndex([], 0, 0, "staging")).toBeNull();
  });

  test("returns a key for a valid index", () => {
    const files = [file("a.ts"), file("b.ts")];
    // stagedCount=1 means index 0 is staged, index 1 is changes
    expect(fileKeyFromIndex(files, 1, 1, "staging")).toBe("changes:b.ts");
  });

  test("returns staged key when in staged range", () => {
    const files = [file("a.ts"), file("b.ts")];
    expect(fileKeyFromIndex(files, 0, 2, "staging")).toBe("staged:a.ts");
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

  test("allows valid indices", () => {
    expect(clampIndex(0, 5)).toBe(0);
    expect(clampIndex(2, 5)).toBe(2);
    expect(clampIndex(4, 5)).toBe(4);
  });
});

describe("fileKeyFromIndex in compare mode", () => {
  test("all files get 'compare:' prefix regardless of index", () => {
    const files = [file("a.ts"), file("b.ts"), file("c.ts")];
    expect(fileKeyFromIndex(files, 0, 0, "compare")).toBe("compare:a.ts");
    expect(fileKeyFromIndex(files, 1, 0, "compare")).toBe("compare:b.ts");
    expect(fileKeyFromIndex(files, 2, 0, "compare")).toBe("compare:c.ts");
  });

  test("stagedCount is ignored in compare mode", () => {
    const files = [file("a.ts"), file("b.ts")];
    // Even with stagedCount=2, compare mode ignores section logic
    expect(fileKeyFromIndex(files, 0, 2, "compare")).toBe("compare:a.ts");
    expect(fileKeyFromIndex(files, 1, 2, "compare")).toBe("compare:b.ts");
  });

  test("returns null for empty files in compare mode", () => {
    expect(fileKeyFromIndex([], 0, 0, "compare")).toBeNull();
  });

  test("returns null for out-of-range index in compare mode", () => {
    const files = [file("a.ts")];
    expect(fileKeyFromIndex(files, 5, 0, "compare")).toBeNull();
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
