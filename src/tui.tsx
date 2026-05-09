import { addDefaultParsers } from "@opentui/core";
import { useKeyboard, useRenderer, useSelectionHandler } from "@opentui/solid";

import { $dialog } from "@/store/dialog.store";

import { copySelection } from "@/lib/clipboard";
import { parsers } from "@/lib/treesitter/parsers";

import { DiffPane } from "@/component/diff-pane";
import { Sidebar } from "@/component/sidebar";
import { Dialog } from "@/component/ui/dialog";
import { DialogSelectDemo } from "@/component/ui/dialog-select-demo";
import { Toast } from "@/component/ui/toast";

addDefaultParsers(parsers);

export function TUI() {
  const renderer = useRenderer();

  useKeyboard((key) => {
    if (key.name === "q") {
      renderer.destroy();
    }

    if (key.ctrl && key.name === "d") {
      $dialog.action.replace({ component: DialogSelectDemo });
    }
  });

  useSelectionHandler(() => {
    copySelection(renderer);
  });

  return (
    <box width="100%" height="100%" flexDirection="row">
      <Sidebar />
      <DiffPane />

      <Dialog />
      <Toast />
    </box>
  );
}
