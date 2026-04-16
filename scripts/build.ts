import fs from "fs";
import path from "path";

const compileTarget = process.arch === "x64" ? "bun-darwin-x64" : "bun-darwin-arm64";

const parserWorker = fs.realpathSync(
  path.resolve("node_modules/@opentui/core/parser.worker.js"),
);

const bunfsRoot = "/$bunfs/root/";
const workerRelativePath = path.relative(process.cwd(), parserWorker).replace(/\\/g, "/");

const result = await Bun.build({
  target: "bun",
  compile: {
    target: compileTarget,
    outfile: "dist/changes",
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

console.log("Built dist/changes");
