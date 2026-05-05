import { useKeyboard, useRenderer } from "@opentui/solid";

export function TUI() {
  const renderer = useRenderer();

  useKeyboard((key) => {
    if (key.name === "q") {
      renderer.destroy();
    }
  });

  return (
    <box border padding={1} flexDirection="column" gap={1} width="100%" height="100%">
      <text fg="black">Hello, World!</text>
    </box>
  );
}
