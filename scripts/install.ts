import { chmod, copyFile, mkdir } from "node:fs/promises";

const binName = "sourcery";
const sourceBin = "dist/sourcery";
const prefix = process.env.PREFIX ?? `${process.env.HOME}/.local`;
const installDir = `${prefix}/bin`;
const targetBin = `${installDir}/${binName}`;

if (!(await Bun.file(sourceBin).exists())) {
  console.log("Binary not found, building...");
  const result = Bun.spawnSync(["bun", "run", "scripts/build.ts"], {
    stdout: "inherit",
    stderr: "inherit",
  });
  if (!result.success) process.exit(1);
}

await mkdir(installDir, { recursive: true });
await copyFile(sourceBin, targetBin);
await chmod(targetBin, 0o755);

console.log(`Installed ${binName} to ${targetBin}`);
