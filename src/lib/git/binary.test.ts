import { describe, expect, test } from "bun:test";

import { BINARY_UNSUPPORTED_REASON, getUnsupportedReason } from "./binary";

describe("getUnsupportedReason", () => {
  test("treats svg as text instead of unsupported binary", () => {
    expect(getUnsupportedReason("assets/logo.svg", new TextEncoder().encode("<svg />"))).toBe(
      null,
    );
  });

  test("flags obvious binary content", () => {
    expect(
      getUnsupportedReason("assets/logo.png", new Uint8Array([0x89, 0x50, 0x4e, 0x47])),
    ).toBe("Unsupported file type: .png");
  });

  test("returns the shared binary reason for sampled binary data", () => {
    expect(getUnsupportedReason("src/data.txt", new Uint8Array([0x00, 0x01, 0x02]))).toBe(
      BINARY_UNSUPPORTED_REASON,
    );
  });
});
