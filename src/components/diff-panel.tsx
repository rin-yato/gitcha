import type { DiffViewMode } from "../state";
import type { Theme } from "../styles/theme";

export function DiffPanel(props: {
  theme: Theme;
  selectedFile: string | null;
  diffContent: string | null;
  diffViewMode: DiffViewMode;
  toggleDiffViewMode: () => void;
}) {
  return (
    <box
      id="diff-panel"
      backgroundColor={props.theme.background}
      flexGrow={1}
      flexDirection="column"
      paddingX={1}
      paddingY={1}
    >
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <box flexDirection="column">
          <text fg={props.theme.text} attributes={1} selectable={false}>
            Diff Review
          </text>
          <text fg={props.theme.textMuted} selectable={false}>
            {props.selectedFile || "select a file"}
          </text>
        </box>
        <text fg={props.theme.textMuted} selectable={false}>
          {props.diffViewMode}
        </text>
      </box>

      {props.selectedFile ? (
        props.diffContent ? (
          <diff
            diff={props.diffContent}
            view={props.diffViewMode}
            showLineNumbers
            fg={props.theme.text}
            selectionBg={`${props.theme.accent}16`}
            addedBg={`${props.theme.added}12`}
            removedBg={`${props.theme.removed}12`}
            contextBg={props.theme.background}
            lineNumberFg={props.theme.textMuted}
            lineNumberBg={props.theme.surface}
          />
        ) : (
          <text content="Loading diff..." fg={props.theme.textMuted} selectable={false} />
        )
      ) : (
        <box flexDirection="column" flexGrow={1} justifyContent="center">
          <text
            content="Select a change from the left to review it here"
            fg={props.theme.textMuted}
            selectable={false}
          />
          <text
            content="space switches unified and split views"
            fg={props.theme.textMuted}
            selectable={false}
          />
        </box>
      )}
    </box>
  );
}
