import { detectFiletype } from "./syntax";
import { describe, expect, test } from "bun:test";

describe("detectFiletype", () => {
  test("returns undefined for null input", () => {
    expect(detectFiletype(null)).toBeUndefined();
  });

  test("detects file types from path", () => {
    expect(detectFiletype("src/app.tsx")).toBe("typescriptreact");
  });
});
