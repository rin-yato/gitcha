import { type InputRenderable, TextAttributes } from "@opentui/core";

import type { Accessor } from "solid-js";

import { $theme } from "@/store/theme.store";

import { EX_PROMPT_INPUT_WIDTH } from "./constants";

type PromptInputProps = {
  value: Accessor<string>;
  usage: Accessor<string>;
  hasSuggestion: Accessor<boolean>;
  setInputRef: (input: InputRenderable) => void;
  onInput: (value: string) => void;
};

export function PromptInput(props: PromptInputProps) {
  return (
    <>
      <text id="ex-command-prompt-hint" fg={$theme.token.fgMuted} height={1}>
        tab complete | up/down | page | enter | esc
      </text>
      <box width="100%" flexDirection="row" backgroundColor={$theme.token.bg} paddingY={1}>
        <text width={1} height={1} fg={$theme.token.fgMuted} attributes={TextAttributes.BOLD}>
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
          backgroundColor={$theme.token.bg}
          focusedBackgroundColor={$theme.token.bg}
          textColor={$theme.token.fg}
          focusedTextColor={$theme.token.fg}
          placeholderColor={$theme.token.fgMuted}
          cursorColor={$theme.token.accent}
          onInput={props.onInput}
        />
      </box>
      <text
        id="ex-command-prompt-usage"
        fg={props.hasSuggestion() ? $theme.token.fg : $theme.token.fgMuted}
        height={1}
      >
        {props.usage()}
      </text>
    </>
  );
}
