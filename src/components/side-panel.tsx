import type { JSX } from "solid-js";

export function SidePanel(props: {
  title: string;
  accent: string;
  children: JSX.Element;
  width?: number | "auto" | `${number}%`;
}) {
  return (
    <box
      backgroundColor="transparent"
      border
      borderStyle="rounded"
      borderColor={props.accent}
      width={props.width ?? "100%"}
      flexDirection="column"
      padding={1}
    >
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <text fg={props.accent} attributes={1} selectable={false}>
          {props.title}
        </text>
      </box>
      {props.children}
    </box>
  );
}
