import type { CliRenderer, KeyEvent, Renderable } from "@opentui/core";
import type { Command } from "@opentui/keymap";
import type { ExCommandPayload } from "@opentui/keymap/addons/opentui";

import type { ExArgCount } from "./ex-command-input";

export type AppExCommand = Command<Renderable, KeyEvent, ExCommandPayload> & {
  name: string;
  aliases?: string[];
  nargs?: ExArgCount;
  title: string;
  desc: string;
  category: string;
  usage: string;
};

type CreateAppExCommandsOptions = {
  renderer: CliRenderer;
  executeGitCommand: (raw: string) => Promise<void>;
  refresh: () => Promise<unknown>;
  notify: (message: string) => void;
  toggleSidebar: () => void;
};

export function createAppExCommands(options: CreateAppExCommandsOptions): AppExCommand[] {
  return [
    {
      name: "quit",
      aliases: ["q"],
      nargs: "0",
      title: "Quit",
      desc: "Quit gitcha",
      category: "App",
      usage: ":quit",
      run() {
        options.renderer.destroy();
      },
    },
    {
      name: "refresh",
      aliases: ["reload", "r"],
      nargs: "0",
      title: "Refresh",
      desc: "Refresh git status",
      category: "Git",
      usage: ":refresh",
      async run() {
        await options.refresh();
        options.notify("Refreshed git status");
      },
    },
    {
      name: "sidebar",
      aliases: ["sb"],
      nargs: "0",
      title: "Toggle sidebar",
      desc: "Toggle sidebar",
      category: "View",
      usage: ":sidebar",
      run() {
        options.toggleSidebar();
      },
    },
    {
      name: "git",
      nargs: "+",
      title: "Run git command",
      desc: "Run git command",
      category: "Git",
      usage: ":git <git-args>",
      async run({ payload }) {
        await options.executeGitCommand(payload.raw);
      },
    },
  ];
}
