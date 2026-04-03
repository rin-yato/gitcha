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
      border
      borderStyle="rounded"
      borderColor={props.theme.border}
      flexGrow={1}
      flexDirection="column"
      padding={1}
    >
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <text fg={props.theme.accent} attributes={1} selectable={false}>
          DIFF VIEW
        </text>
        <text fg={props.theme.textMuted} selectable={false}>
          {props.diffViewMode === "unified" ? "unified" : "split"}
        </text>
      </box>

      {props.selectedFile ? (
        <>
          <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
            <text fg={props.theme.text} attributes={1} selectable={true}>
              📄 {props.selectedFile}
            </text>
            <text fg={props.theme.textMuted} selectable={false}>
              space: toggle diff mode
            </text>
          </box>
          {props.diffContent ? (
            <diff
              diff={props.diffContent}
              view={props.diffViewMode}
              showLineNumbers
              fg={props.theme.text}
              selectionBg={`${props.theme.accent}40`}
              addedBg={`${props.theme.added}20`}
              removedBg={`${props.theme.removed}20`}
              contextBg={props.theme.background}
            />
          ) : (
            <text content="Loading diff..." fg={props.theme.textMuted} selectable={false} />
          )}
        </>
      ) : (
        <box flexDirection="column" flexGrow={1} justifyContent="center" alignItems="center">
          <text content="📄" fg={props.theme.textMuted} selectable={false} />
          <text
            content="Select a file to view diff"
            fg={props.theme.textMuted}
            selectable={false}
          />
        </box>
      )}
    </box>
  );
}
