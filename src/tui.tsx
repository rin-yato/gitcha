import { render, useKeyboard, useRenderer } from "@opentui/solid";

import { createSignal } from "solid-js";

const App = () => {
  const renderer = useRenderer();
  const [count, setCount] = createSignal(0);

  useKeyboard((key) => {
    if (key.name === "up") {
      setCount((current) => current + 1);
      return;
    }

    if (key.name === "down") {
      setCount((current) => current - 1);
      return;
    }

    if (key.name === "escape") {
      renderer.destroy();
    }
  });

  return (
    <box border padding={1} flexDirection="column" gap={1} width="100%" height="100%">
      <text fg="#8BD5CA">gitcha SolidJS starter</text>
      <text>Count: {count()}</text>
      <text fg="#A0A0A0">Up / Down change the value. Press Esc to quit.</text>
    </box>
  );
};

export const TUI = {
  run: () => render(() => <App />),
};
