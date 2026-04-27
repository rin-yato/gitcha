import { describe, expect, test } from "bun:test";

import { upgradeApp } from "./upgrade";

describe("upgradeApp", () => {
  test("exits cleanly when already up to date", async () => {
    const logs: string[] = [];
    const originalVersion = process.env.CHANGES_APP_VERSION;
    const originalArgv1 = process.argv[1];

    process.env.CHANGES_APP_VERSION = "0.1.6";
    process.argv[1] = "/usr/local/bin/gc";

    try {
      const code = await upgradeApp({
        fetchLatest: async () => "v0.1.6",
        logger: {
          log: (message) => logs.push(message),
          error: (message) => logs.push(`ERR:${message}`),
        },
      });

      expect(code).toBe(0);
      expect(logs.some((entry) => entry.includes("already up to date"))).toBe(true);
    } finally {
      process.env.CHANGES_APP_VERSION = originalVersion;
      process.argv[1] = originalArgv1 ?? process.execPath;
    }
  });

  test("prints a helpful error for unsupported installs", async () => {
    const logs: string[] = [];
    const originalArgv1 = process.argv[1];
    process.argv[1] = "/work/src/index.tsx";

    try {
      const code = await upgradeApp({
        fetchLatest: async () => "v0.1.7",
        logger: {
          log: (message) => logs.push(message),
          error: (message) => logs.push(`ERR:${message}`),
        },
      });

      expect(code).toBe(1);
      expect(logs.some((entry) => entry.includes("only supported"))).toBe(true);
    } finally {
      process.argv[1] = originalArgv1 ?? process.execPath;
    }
  });
});
