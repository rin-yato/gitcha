const platform = process.platform;
const arch = process.arch;

const targetMap: Record<string, string> = {
  "darwin-x64": "bun-darwin-x64",
  "darwin-arm64": "bun-darwin-arm64",
  "linux-x64": "bun-linux-x64",
  "linux-arm64": "bun-linux-arm64",
  "win32-x64": "bun-windows-x64",
  "win32-arm64": "bun-windows-arm64",
};

const localTarget = `${platform}-${arch}`;

const compileTarget = (process.env.BUILD_TARGET ?? targetMap[localTarget]) as
  | "bun-linux-x64"
  | "bun-darwin-x64"
  | "bun-darwin-arm64"
  | "bun-linux-arm64"
  | "bun-windows-x64"
  | "bun-windows-arm64";

const outfile = process.env.BUILD_OUTFILE ?? "bin/gitcha";

const result = await Bun.build({
  target: "bun",
  compile: {
    target: compileTarget,
    outfile,
    execArgv: ["--"],
  },
  entrypoints: ["./src/index.tsx", "./node_modules/@opentui/core/parser.worker.js"],
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

export {};
