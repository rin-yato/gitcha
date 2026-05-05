import { useKeyboard } from "@opentui/solid";

import { Show } from "solid-js";

import { $sidebar } from "@/store/sidebar.store";
import { $theme } from "@/store/theme.store";

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
      <box backgroundColor={$theme.token.surface} width={$sidebar.width}>
        <text fg="black">
          Sidebar&nbsp;
          <span style={{ fg: $theme.token.added }}>{$sidebar.width}</span>
        </text>
      </box>
    </Show>
  );
}
