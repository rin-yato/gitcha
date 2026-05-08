import { Dynamic } from "@opentui/solid";

import { createMemo, Show } from "solid-js";

import { $dialog, topDialog } from "@/store/dialog.store";

export function Dialog() {
  const currentDialog = createMemo(() => topDialog($dialog.stack));

  return (
    <Show when={currentDialog()}>
      {(dialog) => (
        <box
          id="dialog-backdrop"
          position="absolute"
          top={0}
          left={0}
          width="100%"
          height="100%"
          zIndex={5000}
          justifyContent="center"
          alignItems="center"
          backgroundColor="#00000088"
          onMouseUp={(event) => {
            if (event.target?.id === "dialog-backdrop") {
              $dialog.action.close();
            }
          }}
        >
          <Dynamic component={dialog().component} />
        </box>
      )}
    </Show>
  );
}
