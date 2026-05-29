import { TextAttributes } from "@opentui/core";

import { createMemo, type JSX, Show } from "solid-js";

import { useTheme } from "@/context/theme";

export function Option(props: {
  title: string;
  description?: string;
  active?: boolean;
  current?: boolean;
  footer?: JSX.Element | string;
  gutter?: () => JSX.Element;
}) {
  const theme = useTheme();
  const fg = createMemo(() => {
    if (props.active) return theme.state.token.accentFg;
    if (props.current) return theme.state.token.accent;
    return theme.state.token.fg;
  });

  return (
    <>
      <Show when={props.current}>
        <text flexShrink={0} fg={fg()}>
          ●
        </text>
      </Show>

      <Show when={!props.current && props.gutter}>
        <box flexShrink={0}>{props.gutter?.()}</box>
      </Show>

      <text
        flexGrow={1}
        fg={fg()}
        attributes={props.active ? TextAttributes.BOLD : undefined}
        overflow="hidden"
        wrapMode="none"
        paddingLeft={3}
      >
        {props.title}

        <Show when={props.description}>
          <span
            style={{
              fg: props.active ? theme.state.token.accentFg : theme.state.token.fgMuted,
            }}
          >
            &nbsp;
            {props.description}
          </span>
        </Show>
      </text>

      <Show when={props.footer}>
        <box flexShrink={0}>
          <text fg={props.active ? theme.state.token.accentFg : theme.state.token.fgMuted}>
            {props.footer}
          </text>
        </box>
      </Show>
    </>
  );
}
