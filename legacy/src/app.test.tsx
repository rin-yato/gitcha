import { describe, expect, test } from "bun:test";

import { mergeCompareData } from "./app";

describe("mergeCompareData", () => {
  test("preserves existing data when applying partial updates", () => {
    const current = {
      branches: [{ ref: "main", label: "main" }],
      commits: [{ ref: "abc", message: "abc commit", origin: "main" }],
      defaultCompareTarget: { mode: "base-branch" as const, ref: "main", label: "main" },
    };

    expect(
      mergeCompareData(current, {
        branches: [{ ref: "feature/x", label: "feature/x" }],
      }),
    ).toEqual({
      branches: [{ ref: "feature/x", label: "feature/x" }],
      commits: current.commits,
      defaultCompareTarget: current.defaultCompareTarget,
    });
  });
});
