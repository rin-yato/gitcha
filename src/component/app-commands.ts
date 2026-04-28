import { type AppKeybindings, formatShortcutLabel } from "@/lib/config";

import type { CommandOption } from "@/component/dialog-command";
import type { DialogSelectOption } from "@/component/ui/dialog-select";

const COMMAND_CATEGORIES = ["View", "Action", "Layout", "Appearance"] as const;
const SUGGESTED_COMMAND_IDS = [
  "refresh",
  "toggle-compare",
  "toggle-diff-view",
  "status",
  "upgrade",
] as const;

export type CommandHost = {
  toggleDiffViewMode: () => void;
  exitCompareMode: () => void;
  stageSelectedFile: () => void;
  unstageSelectedFile: () => void;
  discardSelectedFile: () => void;
  shrinkSidebar: () => void;
  growSidebar: () => void;
  toggleSidebar: () => void;
  openConfigFile: () => void;
  upgradeApp: () => void;
};

export function buildCommandMap(commands: CommandOption[]): Record<string, CommandOption> {
  return Object.fromEntries(commands.map((command) => [command.id, command]));
}

export function buildCommandSelectOptions(
  commands: CommandOption[],
): DialogSelectOption<string>[] {
  const suggestedCommands = commands.filter((command) =>
    SUGGESTED_COMMAND_IDS.includes(command.id as (typeof SUGGESTED_COMMAND_IDS)[number]),
  );
  const suggestedIds = new Set(suggestedCommands.map((command) => command.id));

  return [
    ...suggestedCommands.map((command) => ({
      title: command.label,
      value: command.id,
      description: command.slash,
      category: "Suggested",
    })),
    ...COMMAND_CATEGORIES.flatMap((category) =>
      commands
        .filter((command) => command.category === category && !suggestedIds.has(command.id))
        .map((command) => ({
          title: command.label,
          value: command.id,
          description: command.slash,
          category,
        })),
    ),
  ] satisfies DialogSelectOption<string>[];
}

export function buildCommandOptions(args: {
  refresh: () => void;
  showCompareBranchDialog: () => void;
  showThemeDialog: () => void;
  showStatusDialog: () => void;
  keybindings: AppKeybindings;
  app: CommandHost;
}): CommandOption[] {
  const {
    refresh,
    showCompareBranchDialog,
    showThemeDialog,
    showStatusDialog,
    keybindings,
    app,
  } = args;

  const shortcut = (id: keyof AppKeybindings) => formatShortcutLabel(keybindings[id]);

  return [
    {
      id: "toggle-compare",
      label: "Compare",
      category: "View",
      slash: shortcut("openCompareDialog"),
      run: showCompareBranchDialog,
    },
    {
      id: "refresh",
      label: "Refresh",
      category: "Action",
      slash: shortcut("refresh"),
      run: refresh,
    },
    {
      id: "status",
      label: "Status",
      category: "View",
      slash: shortcut("openStatusDialog"),
      run: showStatusDialog,
    },
    {
      id: "upgrade",
      label: "Upgrade",
      category: "Action",
      slash: shortcut("upgradeApp"),
      run: app.upgradeApp,
    },
    {
      id: "toggle-diff-view",
      label: "Diff View",
      category: "View",
      slash: shortcut("toggleDiffView"),
      run: app.toggleDiffViewMode,
    },
    {
      id: "exit-compare",
      label: "Exit Compare",
      category: "View",
      run: app.exitCompareMode,
    },
    {
      id: "stage-file",
      label: "Stage",
      category: "Action",
      slash: shortcut("stageSelectedFile"),
      run: app.stageSelectedFile,
    },
    {
      id: "unstage-file",
      label: "Unstage",
      category: "Action",
      slash: shortcut("unstageSelectedFile"),
      run: app.unstageSelectedFile,
    },
    {
      id: "discard-file",
      label: "Discard",
      category: "Action",
      slash: shortcut("discardSelectedFile"),
      run: app.discardSelectedFile,
    },
    {
      id: "shrink-sidebar",
      label: "Narrow Sidebar",
      category: "Layout",
      slash: shortcut("shrinkSidebar"),
      run: app.shrinkSidebar,
    },
    {
      id: "grow-sidebar",
      label: "Wider Sidebar",
      category: "Layout",
      slash: shortcut("growSidebar"),
      run: app.growSidebar,
    },
    {
      id: "toggle-sidebar",
      label: "Toggle Sidebar",
      category: "Layout",
      slash: shortcut("toggleSidebar"),
      run: app.toggleSidebar,
    },
    {
      id: "switch-theme",
      label: "Theme",
      category: "Appearance",
      slash: shortcut("openThemeDialog"),
      run: showThemeDialog,
    },
    {
      id: "open-config",
      label: "Config",
      category: "Appearance",
      run: app.openConfigFile,
    },
  ];
}
