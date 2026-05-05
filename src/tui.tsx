import { useKeyboard, useRenderer, useSelectionHandler } from "@opentui/solid";

import { copySelection } from "@/lib/clipboard";

import { DiffPane } from "@/component/diff-pane";
import { Sidebar } from "@/component/sidebar";

export function TUI() {
  const renderer = useRenderer();

  useKeyboard((key) => {
    if (key.name === "q") {
      renderer.destroy();
    }
  });

  useSelectionHandler(() => {
    copySelection(renderer);
  });

  return (
    <box width="100%" height="100%" flexDirection="row">
      <Sidebar />
      <DiffPane />
    </box>
  );
}
