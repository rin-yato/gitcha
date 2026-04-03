import { For, Show } from "solid-js";

import type { GitRepoStatus, GitStatusFile } from "../git";
import type { FileSection } from "../state";
import type { Theme } from "../styles/theme";

const STATUS_SYMBOLS: Record<string, string> = {
  A: "+",
  M: "~",
  D: "-",
  R: "→",
  C: "©",
  U: "!",
  "?": "?",
  " ": " ",
};

function getFileColor(file: GitStatusFile, theme: Theme): string {
  const status = file.workingTreeStatus;
  switch (status) {
    case "A":
      return theme.added;
    case "M":
      return theme.modified;
    case "D":
      return theme.removed;
    case "R":
    case "U":
      return theme.warning;
    case "?":
      return theme.textMuted;
    default:
      return status !== " " ? theme.modified : theme.text;
  }
}

function FlatFileItem(props: {
  file: GitStatusFile;
  section: FileSection;
  isSelected: boolean;
  isActive: boolean;
  onSelect: () => void;
  theme: Theme;
}) {
  const rowBackground = () => {
    if (props.isSelected) return `${props.theme.accent}12`;
    if (props.isActive) return props.theme.surface;
    return undefined;
  };

  const status =
    props.file.workingTreeStatus !== " "
      ? props.file.workingTreeStatus
      : props.file.indexStatus;
  const symbol = STATUS_SYMBOLS[status] || " ";

  const fileName = props.file.path.split("/").pop() || props.file.path;
  const folderPath = props.file.path.includes("/")
    ? props.file.path.substring(0, props.file.path.lastIndexOf("/"))
    : "";

  return (
    <box
      ref={(el) => {
        if (el) {
          el.onMouseUp = props.onSelect;
        }
      }}
      flexDirection="row"
      width="100%"
      backgroundColor={rowBackground()}
    >
      <text
        content={`${symbol} ${fileName}`}
        fg={
          props.isSelected
            ? props.theme.text
            : props.isActive
              ? props.theme.accent
              : getFileColor(props.file, props.theme)
        }
        selectable={true}
      />
      <Show when={folderPath}>
        <text content={`  ${folderPath}`} fg={props.theme.textMuted} selectable={false} />
      </Show>
    </box>
  );
}

export function SourceControlPanel(props: {
  theme: Theme;
  status: GitRepoStatus | null;
  error: string | null;
  selectedFile: string | null;
  focusedPath: string | null;
  selectFile: (path: string, section?: FileSection) => void;
  stageSelectedFile: () => void;
  unstageSelectedFile: () => void;
  discardSelectedFile: () => void;
  refreshStatus: () => void;
}) {
  return (
    <box backgroundColor={props.theme.surface} width="30%" flexDirection="column">
      <Show when={props.error}>
        <text fg={props.theme.error} selectable={true}>
          {props.error}
        </text>
      </Show>

      <Show when={props.status}>
        {(s: () => GitRepoStatus) => (
          <box flexDirection="column" flexGrow={1}>
            <Show when={s().files.staged.length > 0}>
              <box flexDirection="row" gap={1}>
                <text
                  content="Staged"
                  fg={props.theme.text}
                  attributes={1}
                  selectable={false}
                />
                <text
                  content={`· ${s().files.staged.length}`}
                  fg={props.theme.added}
                  selectable={false}
                />
              </box>
              <For each={s().files.staged}>
                {(file) => (
                  <FlatFileItem
                    file={file}
                    section="staged"
                    isSelected={props.focusedPath === file.path}
                    isActive={props.selectedFile === file.path}
                    onSelect={() => props.selectFile(file.path, "staged")}
                    theme={props.theme}
                  />
                )}
              </For>
            </Show>

            <Show when={s().files.changes.length > 0}>
              <box flexDirection="row" gap={1}>
                <text
                  content="Changes"
                  fg={props.theme.text}
                  attributes={1}
                  selectable={false}
                />
                <text
                  content={`· ${s().files.changes.length}`}
                  fg={props.theme.modified}
                  selectable={false}
                />
              </box>
              <For each={s().files.changes}>
                {(file) => (
                  <FlatFileItem
                    file={file}
                    section="changes"
                    isSelected={props.focusedPath === file.path}
                    isActive={props.selectedFile === file.path}
                    onSelect={() => props.selectFile(file.path, "changes")}
                    theme={props.theme}
                  />
                )}
              </For>
            </Show>

            <Show when={s().totalFiles === 0}>
              <text
                content="Working tree clean"
                fg={props.theme.textMuted}
                selectable={false}
              />
            </Show>
          </box>
        )}
      </Show>
    </box>
  );
}
