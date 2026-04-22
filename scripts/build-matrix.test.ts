import { describe, expect, test } from "bun:test";

import { createBuildMatrixConfig } from "./build-matrix";

describe("createBuildMatrixConfig", () => {
  test("defaults to the host build when no target is provided", () => {
    const config = createBuildMatrixConfig(
      {},
      "/work/node_modules/@opentui/core/parser.worker.js",
      "/work",
    );

    expect(config.compile).toEqual({
      outfile: "bin/gitcha",
      execArgv: ["--"],
    });
  });

  test("uses BUILD_TARGET for release builds", () => {
    const config = createBuildMatrixConfig(
      { BUILD_TARGET: "bun-darwin-x64", BUILD_OUTFILE: "bin/gitcha" },
      "/work/node_modules/@opentui/core/parser.worker.js",
      "/work",
    );

    expect(config.compile).toEqual({
      target: "bun-darwin-x64",
      outfile: "bin/gitcha",
      execArgv: ["--"],
    });
  });
});
