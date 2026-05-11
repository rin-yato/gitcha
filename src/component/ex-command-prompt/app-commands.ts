import type { CliRenderer, KeyEvent, Renderable } from "@opentui/core";
import type { Command } from "@opentui/keymap";
import type { ExCommandPayload } from "@opentui/keymap/addons/opentui";

import { $git } from "@/store/git.store";
import { $sidebar } from "@/store/sidebar";
import { $toast } from "@/store/toast.store";

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
        await $git.action.refresh();
        $toast.action.success("Refreshed git status");
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
        $sidebar.action.toggle();
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
