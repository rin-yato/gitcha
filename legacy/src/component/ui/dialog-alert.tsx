import { useDialog } from "./dialog";
import type { Theme } from "@/context/theme/provider";

export type DialogAlertProps = {
  theme: Theme;
  title: string;
  message: string;
  onConfirm?: () => void;
};

export function DialogAlert(props: DialogAlertProps) {
  const dialog = useDialog();

  function handleConfirm() {
    props.onConfirm?.();
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
      <box flexDirection="row" justifyContent="flex-end" paddingBottom={1}>
        <box
          paddingLeft={3}
          paddingRight={3}
          backgroundColor={props.theme.accent}
          onMouseUp={handleConfirm}
        >
          <text fg={props.theme.background} selectable={false}>
            ok
          </text>
        </box>
      </box>
    </box>
  );
}
