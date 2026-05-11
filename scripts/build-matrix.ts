import solidPlugin from "@opentui/solid/bun-plugin";

import fs from "fs";
import path from "path";

type BuildMatrixEnv = NodeJS.ProcessEnv;

type BuildConfig = Parameters<typeof Bun.build>[0];

type BuildTarget =
  Extract<NonNullable<BuildConfig["compile"]>, { target?: unknown }> extends {
    target?: infer Target;
  }
    ? Target
    : never;

const BUNFS_ROOT = "/$bunfs/root/";
const DEFAULT_OUTFILE = "bin/gitcha";
const ENTRYPOINT = "./src/index.tsx";
const WORKER_ENTRYPOINT = "./node_modules/@opentui/core/parser.worker.js";

function createCompileConfig(env: BuildMatrixEnv): NonNullable<BuildConfig["compile"]> {
  const outfile = env.BUILD_OUTFILE ?? DEFAULT_OUTFILE;
  const target = env.BUILD_TARGET as BuildTarget | undefined;
  const compileOptions = { outfile, execArgv: ["--"], autoloadBunfig: false };

  return target ? { ...compileOptions, target } : compileOptions;
}

function toBunfsPath(filePath: string, cwd: string) {
  const relativePath = path.relative(cwd, path.resolve(cwd, filePath)).replace(/\\/g, "/");

  return `${BUNFS_ROOT}${relativePath}`;
}

function resolveOpenTuiWorkerPath(cwd = process.cwd()) {
  return fs.realpathSync(path.resolve(cwd, WORKER_ENTRYPOINT));
}

export function createBuildMatrixConfig(
  env: BuildMatrixEnv,
  workerSourcePath = WORKER_ENTRYPOINT,
  cwd = process.cwd(),
): BuildConfig {
  const workerPath = toBunfsPath(workerSourcePath, cwd);

  return {
    target: "bun",
    compile: createCompileConfig(env),
    entrypoints: [ENTRYPOINT, workerSourcePath],
    plugins: [solidPlugin],
    minify: true,
    define: {
      OTUI_TREE_SITTER_WORKER_PATH: JSON.stringify(workerPath),
    },
  };
}

async function main() {
  const outfile = process.env.BUILD_OUTFILE ?? DEFAULT_OUTFILE;
  const workerSourcePath = resolveOpenTuiWorkerPath();
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
