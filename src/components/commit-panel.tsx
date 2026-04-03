import type { TextareaRenderable } from "@opentui/core";

import type { Theme } from "../styles/theme";

export function CommitPanel(props: {
  theme: Theme;
  commitMessage: () => string;
  setCommitMessage: (value: string) => void;
  commitChanges: (message: string) => void;
  pushChanges: () => void;
  pullChanges: () => void;
}) {
  let textareaRef: TextareaRenderable | undefined;

  const submitCommit = () => {
    props.commitChanges(props.commitMessage());
    props.setCommitMessage("");
    textareaRef?.clear();
    textareaRef?.focus();
  };

  return (
    <box
      backgroundColor={props.theme.surface}
      border
      borderStyle="rounded"
      borderColor={props.theme.border}
      flexDirection="column"
      padding={1}
      width="100%"
    >
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <text fg={props.theme.accent} attributes={1} selectable={false}>
          COMMIT
        </text>
        <text fg={props.theme.textMuted} selectable={false}>
          ctrl+s: commit | meta+enter: submit
        </text>
      </box>

      <textarea
        ref={(el) => {
          if (el) {
            textareaRef = el;
          }
        }}
        initialValue={props.commitMessage()}
        onContentChange={() => props.setCommitMessage(textareaRef?.plainText ?? "")}
        focused
        height={6}
        placeholder="Write commit message..."
        onSubmit={submitCommit}
      />

      <box flexDirection="row" gap={2} paddingTop={1}>
        <text fg={props.theme.textMuted} selectable={false}>
          push/pull available from keyboard
        </text>
      </box>
      <box flexDirection="row" gap={2} paddingTop={1}>
        <text selectable={false} fg={props.theme.added}>
          push
        </text>
        <text selectable={false} fg={props.theme.warning}>
          pull
        </text>
      </box>
    </box>
  );
}
