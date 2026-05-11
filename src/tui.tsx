import { addDefaultParsers } from "@opentui/core";
import { KeymapProvider, useBindings } from "@opentui/keymap/solid";
import { useRenderer, useSelectionHandler } from "@opentui/solid";

import { $exCommand } from "@/store/ex-command.store";

import { copySelection } from "@/lib/clipboard";
import { createAppKeymap } from "@/lib/keymap";
import { parsers } from "@/lib/treesitter/parsers";

import { DiffPane } from "@/component/diff-pane";
import { ExCommandPrompt } from "@/component/ex-command-prompt";
import { Sidebar } from "@/component/sidebar";
import { Dialog } from "@/component/ui/dialog";
import { Toast } from "@/component/ui/toast";

addDefaultParsers(parsers);

function AppKeymapBindings() {
  const renderer = useRenderer();

  useBindings(() => ({
    enabled: () => !$exCommand.visible,
    commands: [
      {
        name: "app.quit",
        run() {
          renderer.destroy();
        },
      },
    ],
    bindings: [
      {
        key: "q",
        cmd: "app.quit",
        desc: "Quit app",
      },
    ],
  }));
}

export function TUI() {
  const renderer = useRenderer();
  const keymap = createAppKeymap(renderer);

  useSelectionHandler(() => {
    copySelection(renderer);
  });

  return (
    <KeymapProvider keymap={keymap}>
      <AppKeymapBindings />

      <Dialog />
      <ExCommandPrompt />
      <Toast />

      <box width="100%" height="100%" flexDirection="row">
        <Sidebar />
        <DiffPane />
      </box>
    </KeymapProvider>
  );
}
