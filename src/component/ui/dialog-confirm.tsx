import { useState } from "react";

import type { Theme } from "@/context/theme/provider";

import { useDialog } from "./dialog";

export type DialogConfirmProps = {
  theme: Theme;
  title: string;
  message: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  confirmLabel?: string;
  cancelLabel?: string;
};

export function DialogConfirm(props: DialogConfirmProps) {
  const dialog = useDialog();
  const [active, _setActive] = useState<"confirm" | "cancel">("confirm");

  function handleConfirm() {
    props.onConfirm?.();
    dialog.clear();
  }

  function handleCancel() {
    props.onCancel?.();
    dialog.clear();
  }

  return (
    <box paddingLeft={2} paddingRight={2} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text attributes={1} fg={props.theme.text} selectable={false}>
          {props.title}
        </text>
        <text fg={props.theme.textMuted} onMouseUp={() => dialog.clear()} selectable={false}>
          esc
        </text>
      </box>
      <box paddingBottom={1}>
        <text fg={props.theme.textMuted} selectable={false}>
          {props.message}
        </text>
      </box>
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1} gap={1}>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={active === "cancel" ? `${props.theme.accent}20` : undefined}
          onMouseUp={handleCancel}
        >
          <text
            fg={active === "cancel" ? props.theme.text : props.theme.textMuted}
            selectable={false}
          >
            {props.cancelLabel ?? "cancel"}
          </text>
        </box>
        <box
          paddingLeft={2}
          paddingRight={2}
          backgroundColor={active === "confirm" ? props.theme.accent : undefined}
          onMouseUp={handleConfirm}
        >
          <text
            fg={active === "confirm" ? props.theme.background : props.theme.textMuted}
            selectable={false}
          >
            {props.confirmLabel ?? "confirm"}
          </text>
        </box>
      </box>
    </box>
  );
}
