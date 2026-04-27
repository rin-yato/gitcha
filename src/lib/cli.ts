import meow from "meow";

export type CliCommand = "upgrade" | null;

export type CliParseResult = {
  command: CliCommand;
  shouldShowHelp: boolean;
  shouldShowVersion: boolean;
  helpText: string;
  version: string;
};

const HELP_TEXT = `
  Usage
    $ gc [upgrade]
    $ gc version
    $ gc --version

  Commands
    upgrade   Check for and install the latest version
    version   Print the current version

  Flags
    --version, -v  Print the current version
    --help, -h     Show help
`;

function buildHelpText(versionText: string): string {
  return `gitcha ${versionText}

${HELP_TEXT.trimStart()}`;
}

export function buildCli(versionText: string, argv = process.argv.slice(2)): CliParseResult {
  const cli = meow(HELP_TEXT, {
    importMeta: import.meta,
    version: versionText,
    argv,
    autoHelp: false,
    autoVersion: false,
    description: false,
    allowUnknownFlags: true,
    flags: {
      help: {
        type: "boolean",
        shortFlag: "h",
      },
      version: {
        type: "boolean",
        shortFlag: "v",
      },
    },
  });

  const command = cli.input[0] ?? null;
  const isKnownCommand =
    command === null || command === "upgrade" || command === "version" || command === "help";

  return {
    command: command === "upgrade" ? "upgrade" : null,
    shouldShowHelp: Boolean(cli.flags.help) || command === "help" || !isKnownCommand,
    shouldShowVersion: Boolean(cli.flags.version) || command === "version",
    helpText: buildHelpText(versionText),
    version: versionText,
  };
}

export function buildCliHelp(versionText: string): string {
  return buildHelpText(versionText);
}
