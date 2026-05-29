import { createEffect, onCleanup, Show } from "solid-js";

import { useTheme } from "@/context/theme";
import { useToast } from "@/context/toast";

const VARIANT_COLORS = {
  success: "success",
  error: "error",
  info: "accent",
  warning: "warning",
} as const;

export function Toast() {
  const toast = useToast();
  const theme = useTheme();
  let autoClearTimer: ReturnType<typeof setTimeout> | null = null;

  createEffect(() => {
    const current = toast.state.current;
    if (current) {
      autoClearTimer = setTimeout(() => {
        toast.clear();
      }, current.duration ?? 3000);
    }
    onCleanup(() => {
      if (autoClearTimer) clearTimeout(autoClearTimer);
    });
  });

  return (
    <Show when={toast.state.current}>
      {(entry) => (
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
          borderColor={theme.state.token[VARIANT_COLORS[entry().variant]]}
          backgroundColor={theme.state.token.surface}
          zIndex={4000}
        >
          <box flexDirection="column">
            <text fg={theme.state.token.fg}>{entry().title}</text>

            <Show when={entry().description}>
              {(description) => <text fg={theme.state.token.fgMuted}>{description()}</text>}
            </Show>
          </box>
        </box>
      )}
    </Show>
  );
}
