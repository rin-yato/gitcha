import path from "path";

export const APP_GITHUB_REPOSITORY = {
  owner: "rin-yato",
  repo: "gitcha",
} as const;

export type InstallMethod = "bun add -g gitcha" | "install.sh";

export type UpgradeCommand = {
  command: string;
  args: string[];
  env?: Record<string, string>;
};

export function getAppVersion(): string {
  return process.env.CHANGES_APP_VERSION ?? "dev";
}

export function getInstalledPath(): string {
  const candidate = process.argv[1];

  if (
    candidate &&
    (candidate.includes(path.sep) || candidate.includes("/") || candidate.includes("\\"))
  ) {
    return candidate;
  }

  return process.execPath;
}

export function classifyInstallMethod(
  execPath: string,
  installedPath: string,
): InstallMethod | null {
  const fileName = path.basename(installedPath);

  if (
    installedPath.endsWith(`${path.sep}src${path.sep}index.tsx`) ||
    installedPath.endsWith(`${path.sep}dist${path.sep}index.js`)
  ) {
    return null;
  }

  if (execPath.includes("bun")) {
    return "bun add -g gitcha";
  }

  if (fileName === "gc" || fileName === "gitcha") {
    return "install.sh";
  }

  const parentDir = path.basename(path.dirname(installedPath));
  if (parentDir === "bin" && (fileName === "gc" || fileName === "gitcha")) {
    return "install.sh";
  }

  return null;
}

function parseVersion(version: string): number[] | null {
  const normalized = version.trim().replace(/^v/, "");
  const parts = normalized.split(".");
  if (parts.length !== 3) return null;

  const parsed = parts.map((part) => Number.parseInt(part, 10));
  if (parsed.some((part) => Number.isNaN(part))) return null;

  return parsed;
}

export function isNewVersionAvailable(currentVersion: string, latestVersion: string): boolean {
  const current = parseVersion(currentVersion);
  const latest = parseVersion(latestVersion);

  if (!current || !latest) return false;

  for (let index = 0; index < 3; index += 1) {
    const currentPart = current[index] ?? 0;
    const latestPart = latest[index] ?? 0;

    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }

  return false;
}

export function getUpgradeCommand(
  installMethod: InstallMethod,
  installedPath: string,
): UpgradeCommand | null {
  if (installMethod === "bun add -g gitcha") {
    return {
      command: "bun",
      args: ["add", "-g", "gitcha@latest"],
    };
  }

  if (installMethod === "install.sh") {
    const prefix =
      path.basename(path.dirname(installedPath)) === "bin"
        ? path.dirname(path.dirname(installedPath))
        : path.dirname(installedPath);

    return {
      command: "sh",
      args: [
        "-c",
        "curl -fsSL https://raw.githubusercontent.com/rin-yato/gitcha/main/install.sh | sh",
      ],
      env: { PREFIX: prefix },
    };
  }

  return null;
}
