import { useKeyboard } from "@opentui/solid";

import { Show } from "solid-js";

import { $sidebar } from "@/store/sidebar.store";

export function Sidebar() {
  useKeyboard((key) => {
    if (key.name === "]") {
      return $sidebar.action.increaseWidth();
    }

    if (key.name === "[") {
      return $sidebar.action.decreaseWidth();
    }

    if (key.name === "\\") {
      return $sidebar.action.toggle();
    }
  });

  return (
    <Show when={$sidebar.open}>
      <box backgroundColor="gray" width={$sidebar.width}>
        <text fg="black">Sidebar {$sidebar.width}</text>
      </box>
    </Show>
  );
}
