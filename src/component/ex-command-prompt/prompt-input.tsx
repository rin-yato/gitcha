import { type InputRenderable, TextAttributes } from "@opentui/core";

import type { Accessor } from "solid-js";

import { EX_PROMPT_INPUT_WIDTH } from "./constants";
import { useTheme } from "@/context/theme";

type PromptInputProps = {
  value: Accessor<string>;
  usage: Accessor<string>;
  hasSuggestion: Accessor<boolean>;
  setInputRef: (input: InputRenderable) => void;
  onInput: (value: string) => void;
};

export function PromptInput(props: PromptInputProps) {
  const theme = useTheme();
  return (
    <>
      <text id="ex-command-prompt-hint" fg={theme.state.token.fgMuted} height={1}>
        tab complete | up/down | page | enter | esc
      </text>
      <box width="100%" flexDirection="row" backgroundColor={theme.state.token.bg} paddingY={1}>
        <text
          width={1}
          height={1}
          fg={theme.state.token.fgMuted}
          attributes={TextAttributes.BOLD}
        >
          :
        </text>

        <input
          id="ex-command-input"
          ref={(input: InputRenderable) => {
            input.cursorOffset = props.value().length;
            props.setInputRef(input);
          }}
          width={EX_PROMPT_INPUT_WIDTH}
          value={props.value()}
          placeholder="git log --oneline"
          backgroundColor={theme.state.token.bg}
          focusedBackgroundColor={theme.state.token.bg}
          textColor={theme.state.token.fg}
          focusedTextColor={theme.state.token.fg}
          placeholderColor={theme.state.token.fgMuted}
          cursorColor={theme.state.token.accent}
          onInput={props.onInput}
        />
      </box>
      <text
        id="ex-command-prompt-usage"
        fg={props.hasSuggestion() ? theme.state.token.fg : theme.state.token.fgMuted}
        height={1}
      >
        {props.usage()}
      </text>
    </>
  );
}
