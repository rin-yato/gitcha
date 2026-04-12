import { describe, expect, test } from "bun:test";

import { detectFiletype } from "./syntax";

describe("detectFiletype", () => {
  test("returns undefined for null input", () => {
    expect(detectFiletype(null)).toBeUndefined();
  });

  test("detects file types from path", () => {
    expect(detectFiletype("src/app.tsx")).toBe("typescriptreact");
  });
});
