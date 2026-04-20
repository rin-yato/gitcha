import fs from "fs";
import path from "path";

const outdir = "dist";

const workerSourcePath = fs.realpathSync(
  path.resolve("node_modules/@opentui/core/parser.worker.js"),
);

const result = await Bun.build({
  target: "bun",
  outdir,
  entrypoints: ["./src/index.tsx", workerSourcePath],
  minify: true,
  splitting: true,
  naming: {
    entry: "[name].[ext]",
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Built ${outdir}`);
