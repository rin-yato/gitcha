import { Show } from "solid-js";

import { $theme } from "@/store/theme.store";
import { $toast } from "@/store/toast.store";

const VARIANT_COLORS = {
  success: "success",
  error: "error",
  info: "accent",
  warning: "warning",
} as const;

export function Toast() {
  return (
    <Show when={$toast.current}>
      {(toast) => (
        <box
          position="absolute"
          top={2}
          right={2}
          maxWidth={60}
          paddingLeft={2}
          paddingRight={2}
          paddingTop={1}
          paddingBottom={1}
          border={["left", "right"]}
          borderStyle="heavy"
          borderColor={$theme.token[VARIANT_COLORS[toast().variant]]}
          backgroundColor={$theme.token.surface}
          zIndex={4000}
        >
          <box flexDirection="column">
            <text fg={$theme.token.fg}>{toast().title}</text>

            <Show when={toast().description}>
              {(description) => <text fg={$theme.token.fgMuted}>{description()}</text>}
            </Show>
          </box>
        </box>
      )}
    </Show>
  );
}
