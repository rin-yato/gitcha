import { describe, expect, test } from "bun:test";

import { Result } from "better-result";

import { parseNameStatus, toStatusFiles } from ".";

describe("git diff parser", () => {
  test("maps name-status diff entries to status files", () => {
    const parsed = parseNameStatus("M\0src/app.ts\0R100\0src/old.ts\0src/new.ts\0");

    expect(Result.isOk(parsed)).toBe(true);
    if (Result.isError(parsed)) return;

    expect(toStatusFiles(parsed.value)).toEqual([
      { path: "src/app.ts", indexStatus: " ", workingTreeStatus: "M" },
      {
        path: "src/new.ts",
        originalPath: "src/old.ts",
        indexStatus: " ",
        workingTreeStatus: "R",
      },
    ]);
  });
});
