import { describe, expect, test } from "bun:test";

import { buildCli, buildCliHelp } from "@/lib/cli";

describe("buildCliHelp", () => {
  test("mentions version and upgrade commands", () => {
    const help = buildCliHelp("v1.2.3");

    expect(help).toContain("upgrade");
    expect(help).toContain("--version");
    expect(help).toContain("Print the current version");
  });
});

describe("buildCli", () => {
  test("parses upgrade commands", () => {
    expect(buildCli("v1.2.3", ["upgrade"]).command).toBe("upgrade");
  });

  test("parses version commands", () => {
    const cli = buildCli("v1.2.3", ["version"]);
    expect(cli.shouldShowVersion).toBe(true);
    expect(cli.command).toBe(null);
  });

  test("parses help commands", () => {
    const cli = buildCli("v1.2.3", ["help"]);
    expect(cli.shouldShowHelp).toBe(true);
    expect(cli.command).toBe(null);
  });

  test("shows help for unknown commands", () => {
    const cli = buildCli("v1.2.3", ["bogus"]);
    expect(cli.shouldShowHelp).toBe(true);
    expect(cli.command).toBe(null);
  });
});
