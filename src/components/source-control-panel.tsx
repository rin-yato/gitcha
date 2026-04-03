import { For, Show } from "solid-js";

import type { GitRepoStatus, GitStatusFile } from "../git";
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
  selectFile: (path: string) => void;
  stageSelectedFile: () => void;
  unstageSelectedFile: () => void;
  discardSelectedFile: () => void;
  refreshStatus: () => void;
}) {
  const totalFiles = () => {
    const s = props.status;
    if (!s) return 0;
    return s.files.staged.length + s.files.changes.length + s.files.untracked.length;
  };

  return (
    <box
      backgroundColor={props.theme.surface}
      width="32%"
      flexDirection="column"
      paddingX={1}
      paddingY={1}
    >
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <box flexDirection="column">
          <text fg={props.theme.text} attributes={1} selectable={false}>
            Source Control
          </text>
          <text fg={props.theme.textMuted} selectable={false}>
            {totalFiles()} files
          </text>
        </box>
      </box>

      <Show when={props.error}>
        <text fg={props.theme.error} selectable={true}>
          {props.error}
        </text>
      </Show>

      <box paddingTop={1} paddingBottom={1}>
        <text fg={props.theme.textMuted} selectable={false}>
          {props.focusedPath || "no file selected"}
        </text>
      </box>

      <Show when={props.status}>
        {(s: () => GitRepoStatus) => (
          <box flexDirection="column" flexGrow={1}>
            <box flexDirection="column" paddingBottom={1}>
              <text
                content={s().branch || "Not a git repository"}
                fg={props.theme.text}
                selectable={false}
              />
              <text
                content={
                  s().upstream
                    ? `${s().aheadCount > 0 ? `↑${s().aheadCount} ` : ""}${s().behindCount > 0 ? `↓${s().behindCount} ` : ""}${s().upstream}`
                    : "local working tree"
                }
                fg={props.theme.textMuted}
                selectable={false}
              />
            </box>

            <box flexDirection="column" flexGrow={1}>
              <Show when={s().files.staged.length > 0}>
                <box flexDirection="row" gap={1} paddingBottom={1} paddingTop={1}>
                  <text
                    content={`Staged · ${s().files.staged.length}`}
                    fg={props.theme.added}
                    selectable={false}
                  />
                </box>
                <For each={s().files.staged}>
                  {(file) => (
                    <FlatFileItem
                      file={file}
                      isSelected={props.focusedPath === file.path}
                      isActive={props.selectedFile === file.path}
                      onSelect={() => props.selectFile(file.path)}
                      theme={props.theme}
                    />
                  )}
                </For>
              </Show>

              <Show when={s().files.changes.length > 0}>
                <box flexDirection="row" gap={1} paddingBottom={1} paddingTop={1}>
                  <text
                    content={`Changes · ${s().files.changes.length}`}
                    fg={props.theme.modified}
                    selectable={false}
                  />
                </box>
                <For each={s().files.changes}>
                  {(file) => (
                    <FlatFileItem
                      file={file}
                      isSelected={props.focusedPath === file.path}
                      isActive={props.selectedFile === file.path}
                      onSelect={() => props.selectFile(file.path)}
                      theme={props.theme}
                    />
                  )}
                </For>
              </Show>

              <Show when={s().files.untracked.length > 0}>
                <box flexDirection="row" gap={1} paddingBottom={1} paddingTop={1}>
                  <text
                    content={`Untracked · ${s().files.untracked.length}`}
                    fg={props.theme.textMuted}
                    selectable={false}
                  />
                </box>
                <For each={s().files.untracked}>
                  {(file) => (
                    <FlatFileItem
                      file={file}
                      isSelected={props.focusedPath === file.path}
                      isActive={props.selectedFile === file.path}
                      onSelect={() => props.selectFile(file.path)}
                      theme={props.theme}
                    />
                  )}
                </For>
              </Show>

              <Show when={s().totalFiles === 0}>
                <box paddingTop={1}>
                  <text
                    content="Working tree clean"
                    fg={props.theme.textMuted}
                    selectable={false}
                  />
                </box>
              </Show>
            </box>

            <box paddingTop={2}>
              <text
                content="j/k move  enter select  s/u stage  r refresh"
                fg={props.theme.textMuted}
                selectable={false}
              />
            </box>
          </box>
        )}
      </Show>
    </box>
  );
}
