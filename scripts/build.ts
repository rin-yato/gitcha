import fs from "fs";
import path from "path";

const outdir = "dist";

const parserWorker = fs.realpathSync(
  path.resolve("node_modules/@opentui/core/parser.worker.js"),
);

const _workerRelativePath = path.relative(process.cwd(), parserWorker).replace(/\\/g, "/");

const result = await Bun.build({
  target: "bun",
  outdir,
  entrypoints: ["./src/index.tsx", parserWorker],
  naming: {
    entry: "[name].js",
  },
  define: {
    OTUI_TREE_SITTER_WORKER_PATH: 'new URL("./parser.worker.js", import.meta.url).href',
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

console.log("Built dist/");
