import { describe, expect, test } from "bun:test";

import { pathIsIgnored } from "./monitor";

describe("pathIsIgnored", () => {
  test("matches exact ignored paths and nested ignored directories", () => {
    const cache = {
      exactPaths: new Set(["/work/ignored.txt"]),
      directoryPrefixes: ["/work/ignored-dir/"],
    };

    expect(pathIsIgnored("/work/ignored.txt", "/work", cache)).toBe(true);
    expect(pathIsIgnored("ignored.txt", "/work", cache)).toBe(true);
    expect(pathIsIgnored("/work/ignored-dir/nested.txt", "/work", cache)).toBe(true);
    expect(pathIsIgnored("tracked.txt", "/work", cache)).toBe(false);
  });
});
