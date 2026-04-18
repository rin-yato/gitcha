import fs from "fs";
import path from "path";

const compileTarget = (process.env.BUILD_TARGET ??
  (process.platform === "win32"
    ? process.arch === "x64"
      ? "bun-windows-x64"
      : "bun-windows-arm64"
    : process.platform === "darwin"
      ? process.arch === "x64"
        ? "bun-darwin-x64"
        : "bun-darwin-arm64"
      : process.arch === "x64"
        ? "bun-linux-x64"
        : "bun-linux-arm64")) as
  | "bun-linux-x64"
  | "bun-darwin-x64"
  | "bun-darwin-arm64"
  | "bun-linux-arm64"
  | "bun-windows-x64"
  | "bun-windows-arm64";

const outfile = process.env.BUILD_OUTFILE ?? "bin/changes";

const parserWorker = fs.realpathSync(
  path.resolve("node_modules/@opentui/core/parser.worker.js"),
);

const bunfsRoot = "/$bunfs/root/";
const workerRelativePath = path.relative(process.cwd(), parserWorker).replace(/\\/g, "/");

const result = await Bun.build({
  target: "bun",
  compile: {
    target: compileTarget,
    outfile,
    execArgv: ["--"],
  },
  entrypoints: ["./src/index.tsx", parserWorker],
  define: {
    OTUI_TREE_SITTER_WORKER_PATH: `"${bunfsRoot}${workerRelativePath}"`,
  },
  minify: true,
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Built ${outfile}`);
