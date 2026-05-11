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
      autoloadBunfig: false,
    });
    expect(config.entrypoints).toEqual([
      "./src/index.tsx",
      "/work/node_modules/@opentui/core/parser.worker.js",
    ]);
    expect(config.plugins).toHaveLength(1);
    expect(config.define?.OTUI_TREE_SITTER_WORKER_PATH).toBe(
      '"/$bunfs/root/node_modules/@opentui/core/parser.worker.js"',
    );
    expect(config.define).not.toHaveProperty("process.env.CHANGES_APP_VERSION");
  });

  test("uses OpenTUI's packaged tree-sitter worker by default", () => {
    const config = createBuildMatrixConfig({}, undefined, "/work");

    expect(config.entrypoints).toEqual([
      "./src/index.tsx",
      "./node_modules/@opentui/core/parser.worker.js",
    ]);
    expect(config.define?.OTUI_TREE_SITTER_WORKER_PATH).toBe(
      '"/$bunfs/root/node_modules/@opentui/core/parser.worker.js"',
    );
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
      autoloadBunfig: false,
    });
  });
});
