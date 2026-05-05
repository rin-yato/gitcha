import { spawn } from "node:child_process";

import {
  classifyInstallMethod,
  getAppVersion,
  getInstalledPath,
  getUpgradeCommand,
  isNewVersionAvailable,
} from "./app-status";
import { createLatestReleaseLookup, type ReleaseLookup } from "./release";

type UpgradeLogger = {
  log: (message: string) => void;
  error: (message: string) => void;
};

type CommandRunner = (
  command: string,
  args: string[],
  env?: Record<string, string>,
) => Promise<void>;

function defaultRunner(
  command: string,
  args: string[],
  env?: Record<string, string>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: { ...process.env, ...env },
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

export async function upgradeApp(
  options: {
    fetchLatest?: ReleaseLookup;
    runCommand?: CommandRunner;
    logger?: UpgradeLogger;
  } = {},
): Promise<number> {
  const logger = options.logger ?? console;
  const installedPath = getInstalledPath();
  const installMethod = classifyInstallMethod(process.execPath, installedPath);

  if (!installMethod) {
    logger.error("Upgrade is only supported for Bun global installs or install.sh installs.");
    return 1;
  }

  const currentVersion = getAppVersion();
  let latestVersion: string | null;

  try {
    latestVersion = await (options.fetchLatest ?? createLatestReleaseLookup())();
  } catch {
    logger.error("Unable to check for updates.");
    return 1;
  }

  if (!latestVersion) {
    logger.error("Unable to check for updates.");
    return 1;
  }

  if (!isNewVersionAvailable(currentVersion, latestVersion)) {
    logger.log(`gitcha is already up to date (${currentVersion}).`);
    return 0;
  }

  const upgradeCommand = getUpgradeCommand(installMethod, installedPath);

  if (!upgradeCommand) {
    logger.error(`Upgrade is not supported for ${installMethod} installs.`);
    return 1;
  }

  logger.log(`Updating gitcha from ${currentVersion} to ${latestVersion}...`);

  const runCommand = options.runCommand ?? defaultRunner;
  try {
    await runCommand(upgradeCommand.command, upgradeCommand.args, upgradeCommand.env);
  } catch (error) {
    logger.error(error instanceof Error ? error.message : "Update failed.");
    return 1;
  }

  logger.log("Update complete.");
  return 0;
}
