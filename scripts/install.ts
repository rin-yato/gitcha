import { execFile } from "node:child_process";
import { access, chmod, copyFile, mkdir } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const binName = "sourcery";
const repoRoot = new URL("..", import.meta.url).pathname;
const sourceBin = `${repoRoot}/dist/${binName}`;
const prefix = process.env.PREFIX ?? `${process.env.HOME ?? "/Users/yato"}/.local`;
const installDir = `${prefix}/bin`;
const targetBin = `${installDir}/${binName}`;

await mkdir(installDir, { recursive: true });

try {
  await access(sourceBin);
} catch {
  await execFileAsync("bun", ["run", "scripts/build.ts"], { cwd: repoRoot });
}

await copyFile(sourceBin, targetBin);
await chmod(targetBin, 0o755);

console.log(`Installed ${binName} to ${targetBin}`);
