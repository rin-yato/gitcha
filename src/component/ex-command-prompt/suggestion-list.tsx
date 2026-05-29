import { TextAttributes } from "@opentui/core";

import { type Accessor, For } from "solid-js";

import { EX_PROMPT_BODY_WIDTH } from "./constants";
import type { ExPromptSuggestion } from "./ex-command-input";
import { useTheme } from "@/context/theme";

export type SuggestionRow =
  | { kind: "empty" }
  | { kind: "suggestion"; suggestion: ExPromptSuggestion };

type SuggestionListProps = {
  rows: Accessor<SuggestionRow[]>;
  selectedIndex: Accessor<number>;
};

export function SuggestionList(props: SuggestionListProps) {
  const theme = useTheme();
  return (
    <box
      id="ex-command-prompt-list"
      width={EX_PROMPT_BODY_WIDTH}
      height={props.rows().length}
      backgroundColor={theme.state.token.surface}
      paddingX={1}
      paddingY={0}
      flexDirection="column"
    >
      <For each={props.rows()}>
        {(row, index) => {
          if (row.kind === "empty") {
            return (
              <text
                id="ex-command-prompt-suggestions"
                fg={theme.state.token.fgMuted}
                height={1}
              >
                (no suggestions)
              </text>
            );
          }

          const isSelected = () => index() === props.selectedIndex();

          return (
            <text
              id={index() === 0 ? "ex-command-prompt-suggestions" : undefined}
              fg={theme.state.token.fg}
              height={1}
            >
              <span
                style={{
                  fg: isSelected() ? theme.state.token.accent : theme.state.token.fgMuted,
                }}
              >
                {isSelected() ? "> " : "  "}
              </span>
              <span
                style={{
                  fg: isSelected() ? theme.state.token.fg : theme.state.token.success,
                  attributes: TextAttributes.BOLD,
                }}
              >
                {row.suggestion.label}
              </span>
              <span style={{ fg: theme.state.token.border }}>{"  "}</span>
              <span style={{ fg: theme.state.token.fgMuted }}>{row.suggestion.desc}</span>
            </text>
          );
        }}
      </For>
    </box>
  );
}
