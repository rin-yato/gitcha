import { addDefaultParsers } from "@opentui/core";
import { KeymapProvider, useBindings } from "@opentui/keymap/solid";
import { useRenderer, useSelectionHandler } from "@opentui/solid";

import { $dialog } from "@/store/dialog.store";

import { copySelection } from "@/lib/clipboard";
import { createAppKeymap } from "@/lib/keymap";
import { parsers } from "@/lib/treesitter/parsers";

import { DiffPane } from "@/component/diff-pane";
import { Sidebar } from "@/component/sidebar";
import { Dialog } from "@/component/ui/dialog";
import { DialogSelectDemo } from "@/component/ui/dialog-select-demo";
import { Toast } from "@/component/ui/toast";

addDefaultParsers(parsers);

function AppKeymapBindings() {
  const renderer = useRenderer();

  useBindings(() => ({
    commands: [
      {
        name: "app.quit",
        run() {
          renderer.destroy();
        },
      },
      {
        name: "dialog.open-select-demo",
        run() {
          $dialog.action.replace({ component: DialogSelectDemo });
        },
      },
    ],
    bindings: [
      {
        key: "q",
        cmd: "app.quit",
        desc: "Quit app",
      },
      {
        key: "ctrl+d",
        cmd: "dialog.open-select-demo",
        desc: "Open dialog demo",
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
      <Toast />

      <box width="100%" height="100%" flexDirection="row">
        <Sidebar />
        <DiffPane />
      </box>
    </KeymapProvider>
  );
}
