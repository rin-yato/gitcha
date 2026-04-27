import { describe, expect, test } from "bun:test";

import { classifyInstallMethod } from "./app-status";

describe("classifyInstallMethod", () => {
  test("detects bun link installs", () => {
    expect(
      classifyInstallMethod("/opt/bun/bin/bun", "/usr/local/bin/node_modules/.bin/gitcha"),
    ).toBe("bun link");
  });

  test("detects bun run installs", () => {
    expect(classifyInstallMethod("/opt/bun/bin/bun", "/work/dist/index.js")).toBe(
      "bun run dist/index.js",
    );
  });

  test("detects binary installs", () => {
    expect(classifyInstallMethod("/usr/local/bin/gitcha", "/usr/local/bin/gitcha")).toBe(
      "binary",
    );
  });
});
