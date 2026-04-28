import { describe, expect, test } from "bun:test";

import {
  classifyInstallMethod,
  getInstalledPath,
  getUpgradeCommand,
  isNewVersionAvailable,
} from "./app-status";

describe("classifyInstallMethod", () => {
  test("detects bun global installs", () => {
    expect(classifyInstallMethod("/opt/bun/bin/bun", "/opt/bun/bin/bun")).toBe(
      "bun add -g gitcha",
    );
  });

  test("defaults to install script installs", () => {
    expect(classifyInstallMethod("/usr/local/bin/gitcha", "/usr/local/bin/gitcha")).toBe(
      "install.sh",
    );
  });

  test("returns null for source installs", () => {
    expect(classifyInstallMethod("/opt/bun/bin/bun", "/work/src/index.tsx")).toBeNull();
  });
});

describe("getInstalledPath", () => {
  test("uses the command path when argv contains one", () => {
    const originalArgv1 = process.argv[1];
    process.argv[1] = "/usr/local/bin/gc";

    try {
      expect(getInstalledPath()).toBe("/usr/local/bin/gc");
    } finally {
      process.argv[1] = originalArgv1 ?? process.execPath;
    }
  });

  test("falls back to execPath when argv is only a subcommand", () => {
    const originalArgv1 = process.argv[1];
    process.argv[1] = "upgrade";

    try {
      expect(getInstalledPath()).toBe(process.execPath);
    } finally {
      process.argv[1] = originalArgv1 ?? process.execPath;
    }
  });
});

describe("isNewVersionAvailable", () => {
  test("detects newer versions", () => {
    expect(isNewVersionAvailable("0.1.6", "v0.1.7")).toBe(true);
  });

  test("rejects same versions", () => {
    expect(isNewVersionAvailable("v0.1.6", "0.1.6")).toBe(false);
  });
});

describe("getUpgradeCommand", () => {
  test("uses bun global install for bun installs", () => {
    expect(getUpgradeCommand("bun add -g gitcha", "/usr/local/bin/gitcha")).toEqual({
      command: "bun",
      args: ["add", "-g", "gitcha@latest"],
    });
  });

  test("uses install script for shell installs", () => {
    expect(getUpgradeCommand("install.sh", "/Users/yato/.local/bin/gc")).toEqual({
      command: "sh",
      args: [
        "-c",
        "curl -fsSL https://raw.githubusercontent.com/rin-yato/gitcha/main/install.sh | sh",
      ],
      env: { PREFIX: "/Users/yato/.local" },
    });
  });
});
