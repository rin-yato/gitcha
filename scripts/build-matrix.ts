import fs from "fs";
import path from "path";

type BuildMatrixEnv = Pick<NodeJS.ProcessEnv, "BUILD_OUTFILE" | "BUILD_TARGET">;

type BuildConfig = Parameters<typeof Bun.build>[0];

const bunfsRoot = "/$bunfs/root/";

export function createBuildMatrixConfig(
  env: BuildMatrixEnv,
  workerSourcePath: string,
  cwd = process.cwd(),
): BuildConfig {
  const outfile = env.BUILD_OUTFILE ?? "bin/gitcha";
  const workerRelativePath = path.relative(cwd, workerSourcePath).replace(/\\/g, "/");

  return {
    target: "bun",
    compile: env.BUILD_TARGET
      ? {
          target: env.BUILD_TARGET,
          outfile,
          execArgv: ["--"],
        }
      : {
          outfile,
          execArgv: ["--"],
        },
    entrypoints: ["./src/index.tsx", workerSourcePath],
    minify: true,
    define: {
      OTUI_TREE_SITTER_WORKER_PATH: `"${bunfsRoot}${workerRelativePath}"`,
    },
  };
}

async function main() {
  const workerSourcePath = fs.realpathSync(
    path.resolve("node_modules/@opentui/core/parser.worker.js"),
  );
  const outfile = process.env.BUILD_OUTFILE ?? "bin/gitcha";
  const result = await Bun.build(createBuildMatrixConfig(process.env, workerSourcePath));

  if (!result.success) {
    console.error("Build failed:");
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  console.log(`Built ${outfile}`);
}

if (import.meta.main) {
  await main();
}
