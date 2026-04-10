import { chmod, copyFile, mkdir, symlink } from "node:fs/promises";

const binName = "changes";
const aliasName = "ch";
const sourceBin = "dist/changes";
const prefix = process.env.PREFIX ?? `${process.env.HOME}/.local`;
const installDir = `${prefix}/bin`;
const targetBin = `${installDir}/${binName}`;
const aliasBin = `${installDir}/${aliasName}`;

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

try {
  await symlink(targetBin, aliasBin);
  console.log(`Installed alias ${aliasName} -> ${binName}`);
} catch (e: unknown) {
  if (e && typeof e === "object" && "code" in e && e.code !== "EEXIST") {
    throw e;
  }
}

console.log(`Installed ${binName} to ${targetBin}`);
