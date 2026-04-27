import path from "path";

export const APP_GITHUB_REPOSITORY = {
  owner: "rin-yato",
  repo: "differ",
} as const;

export function getAppVersion(): string {
  return process.env.CHANGES_APP_VERSION ?? "dev";
}

export function getInstalledPath(): string {
  return process.argv[1] ?? process.execPath;
}

export function classifyInstallMethod(execPath: string, installedPath: string): string {
  if (!execPath.includes("bun")) return "binary";

  if (installedPath.includes(`${path.sep}node_modules${path.sep}.bin${path.sep}`)) {
    return "bun link";
  }

  if (installedPath.endsWith(`${path.sep}dist${path.sep}index.js`)) {
    return "bun run dist/index.js";
  }

  if (installedPath.endsWith(`${path.sep}src${path.sep}index.tsx`)) {
    return "bun run src/index.tsx";
  }

  return "bun";
}
