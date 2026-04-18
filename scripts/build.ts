import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const outdir = "dist";

const workerSourcePath = fs.realpathSync(
  path.resolve("node_modules/@opentui/core/parser.worker.js"),
);

const workerResolvedPath = import.meta.resolve("node_modules/@opentui/core/parser.worker.js");
const absoluteWorkerPath = fileURLToPath(workerResolvedPath);

Bun.build({
  target: "bun",
  outdir,
  entrypoints: ["./src/index.tsx", workerSourcePath],
  // minify: true,
  splitting: true,
  define: {
    OTUI_TREE_SITTER_WORKER_PATH: absoluteWorkerPath,
  },
});
