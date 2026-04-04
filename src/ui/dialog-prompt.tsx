import { useEffect, useRef, useState } from "react";

import type { Theme } from "../context/theme/provider";
import { useDialog } from "./dialog";

export type DialogPromptProps = {
  theme: Theme;
  title: string;
  description?: string;
  placeholder?: string;
  value?: string;
  onConfirm?: (value: string) => void;
  onCancel?: () => void;
};

export function DialogPrompt(props: DialogPromptProps) {
  const dialog = useDialog();
  const [value, setValue] = useState(props.value ?? "");

  function handleSubmit() {
    props.onConfirm?.(value);
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
      <box gap={1}>
        {props.description ? (
          <text fg={props.theme.textMuted} selectable={false}>
            {props.description}
          </text>
        ) : null}
        <input
          value={value}
          onInput={setValue}
          placeholder={props.placeholder ?? "Enter value..."}
          focused
          backgroundColor={props.theme.surface}
          textColor={props.theme.text}
          placeholderColor={props.theme.textMuted}
        />
      </box>
      <box paddingBottom={1} gap={1} flexDirection="row">
        <text fg={props.theme.text} selectable={false}>
          enter <span fg={props.theme.textMuted}>submit</span>
        </text>
      </box>
    </box>
  );
}
