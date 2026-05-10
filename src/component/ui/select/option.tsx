import { TextAttributes } from "@opentui/core";

import { createMemo, type JSX, Show } from "solid-js";

import { $theme } from "@/store/theme.store";

export function Option(props: {
  title: string;
  description?: string;
  active?: boolean;
  current?: boolean;
  footer?: JSX.Element | string;
  gutter?: () => JSX.Element;
}) {
  const fg = createMemo(() => {
    if (props.active) return $theme.token.accentFg;
    if (props.current) return $theme.token.accent;
    return $theme.token.fg;
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
          <span style={{ fg: props.active ? $theme.token.accentFg : $theme.token.fgMuted }}>
            &nbsp;
            {props.description}
          </span>
        </Show>
      </text>

      <Show when={props.footer}>
        <box flexShrink={0}>
          <text fg={props.active ? $theme.token.accentFg : $theme.token.fgMuted}>
            {props.footer}
          </text>
        </box>
      </Show>
    </>
  );
}
