import { useKeyboard, useRenderer, useSelectionHandler } from "@opentui/solid";

import { copySelection } from "./lib/clipboard";

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
    <box border padding={1} flexDirection="column" gap={1} width="100%" height="100%">
      <text fg="black" selectable>
        Hello, World!
      </text>
    </box>
  );
}
