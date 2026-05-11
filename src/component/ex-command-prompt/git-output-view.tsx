import { type ScrollBoxRenderable, TextAttributes } from "@opentui/core";

import { type Accessor, For } from "solid-js";

import { $theme } from "@/store/theme.store";

import { EX_PROMPT_BODY_WIDTH, EX_PROMPT_OUTPUT_ROWS } from "./constants";
import type { GitOutputRow } from "./git-output";

type GitOutputViewProps = {
  rows: Accessor<GitOutputRow[]>;
  height: Accessor<number>;
  setScrollRef: (scroll: ScrollBoxRenderable) => void;
};

export function GitOutputView(props: GitOutputViewProps) {
  return (
    <scrollbox
      id="ex-command-prompt-output"
      width={EX_PROMPT_BODY_WIDTH}
      height={props.height()}
      maxHeight={EX_PROMPT_OUTPUT_ROWS}
      backgroundColor={$theme.token.surface}
      scrollX={false}
      scrollY={true}
      horizontalScrollbarOptions={{ visible: false }}
      contentOptions={{ paddingRight: 1, paddingLeft: 1 }}
      ref={(scroll: ScrollBoxRenderable) => {
        props.setScrollRef(scroll);
        scroll.scrollTo(0);
      }}
    >
      <For each={props.rows()}>
        {(row, index) => (
          <text
            id={index() === 0 ? "ex-command-prompt-output-row" : undefined}
            fg={getOutputRowColor(row)}
            height={1}
            wrapMode="word"
            attributes={row.bold ? TextAttributes.BOLD : undefined}
          >
            {row.text}
          </text>
        )}
      </For>
    </scrollbox>
  );
}

function getOutputRowColor(row: GitOutputRow): string {
  if (row.stream === "stderr") return $theme.token.warning;
  if (row.bold) return $theme.token.accent;
  return $theme.token.fg;
}
