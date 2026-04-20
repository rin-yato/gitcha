import fs from "fs";
import path from "path";

const outfile = process.env.BUILD_OUTFILE ?? "bin/gitcha";

const workerSourcePath = fs.realpathSync(
  path.resolve("node_modules/@opentui/core/parser.worker.js"),
);

const bunfsRoot = "/$bunfs/root/";
const workerRelativePath = path.relative(process.cwd(), workerSourcePath).replace(/\\/g, "/");

const result = await Bun.build({
  target: "bun",
  compile: {
    outfile,
    execArgv: ["--"],
  },
  entrypoints: ["./src/index.tsx", workerSourcePath],
  minify: true,
  define: {
    OTUI_TREE_SITTER_WORKER_PATH: `"${bunfsRoot}${workerRelativePath}"`,
  },
});

if (!result.success) {
  console.error("Build failed:");
  for (const log of result.logs) {
    console.error(log);
  }
  process.exit(1);
}

console.log(`Built ${outfile}`);
