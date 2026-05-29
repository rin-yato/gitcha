import { Dynamic } from "@opentui/solid";

import { createMemo, Show } from "solid-js";

import { topDialog, useDialog } from "@/context/dialog";

export function Dialog() {
  const dialog = useDialog();
  const currentDialog = createMemo(() => topDialog(dialog.state.stack));

  return (
    <Show when={currentDialog()}>
      {(entry) => (
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
              dialog.close();
            }
          }}
        >
          <Dynamic component={entry().component} />
        </box>
      )}
    </Show>
  );
}
