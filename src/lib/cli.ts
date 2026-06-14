import { Result } from "better-result";
import meow, { type AnyFlags, type Result as CliResult } from "meow";

const HELP_TEXT = `
  Usage
    $ gc [command]

  Commands
    version  Show version information
`;

const COMMANDS = {
  version: "version",
  help: "help",
} as const;

const buildCli = () =>
  meow(HELP_TEXT, {
    importMeta: import.meta,
    commands: [COMMANDS.version, COMMANDS.help],
    version: process.env.GITCHA_VERSION,
    autoHelp: true,
    autoVersion: true,
    allowUnknownFlags: true,
  });

async function _handle(fn: () => Promise<void>) {
  await Result.tryPromise({
    try: fn,
    catch: (error) => {
      console.error("Error handling CLI command:", error);
    },
  });

  return "HANDLED" as const;
}

async function handleCli(cli: CliResult<AnyFlags>) {
  // handle version
  if (cli.flags.version || cli.command === COMMANDS.version) {
    return cli.showVersion();
  }

  // handle help
  if (cli.flags.help || cli.command === COMMANDS.help) {
    return cli.showHelp();
  }

  return "TUI";
}

export const CLI = {
  run: async () => {
    return handleCli(buildCli());
  },
};
