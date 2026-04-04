import type React from "react";

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
  switch (file.workingTreeStatus) {
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
      return file.workingTreeStatus !== " " ? theme.modified : theme.text;
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
  const fileName = props.file.path.split("/").pop() || props.file.path;
  const folderPath = props.file.path.includes("/")
    ? props.file.path.substring(0, props.file.path.lastIndexOf("/"))
    : "";
  const status =
    props.file.workingTreeStatus !== " "
      ? props.file.workingTreeStatus
      : props.file.indexStatus;
  const symbol = STATUS_SYMBOLS[status] || " ";

  return (
    <box
      onMouseUp={props.onSelect}
      flexDirection="row"
      width="100%"
      backgroundColor={
        props.isSelected
          ? `${props.theme.accent}12`
          : props.isActive
            ? props.theme.surface
            : undefined
      }
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
      {folderPath ? (
        <text content={`  ${folderPath}`} fg={props.theme.textMuted} selectable={false} />
      ) : null}
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
  const staged = props.status?.files.staged ?? [];
  const changes = props.status?.files.changes ?? [];

  return (
    <box backgroundColor={props.theme.surface} width="30%" flexDirection="column">
      {props.error ? (
        <text fg={props.theme.error} selectable>
          {props.error}
        </text>
      ) : null}

      {staged.length > 0 ? (
        <box flexDirection="column">
          <box flexDirection="row" gap={1}>
            <text content="Staged" fg={props.theme.text} attributes={1} selectable={false} />
            <text content={`· ${staged.length}`} fg={props.theme.added} selectable={false} />
          </box>
          {staged.map((file) => (
            <FlatFileItem
              key={`staged:${file.path}`}
              file={file}
              section="staged"
              isSelected={props.focusedPath === file.path}
              isActive={props.selectedFile === file.path}
              onSelect={() => props.selectFile(file.path, "staged")}
              theme={props.theme}
            />
          ))}
        </box>
      ) : null}

      {changes.length > 0 ? (
        <box flexDirection="column">
          <box flexDirection="row" gap={1}>
            <text content="Changes" fg={props.theme.text} attributes={1} selectable={false} />
            <text
              content={`· ${changes.length}`}
              fg={props.theme.modified}
              selectable={false}
            />
          </box>
          {changes.map((file) => (
            <FlatFileItem
              key={`changes:${file.path}`}
              file={file}
              section="changes"
              isSelected={props.focusedPath === file.path}
              isActive={props.selectedFile === file.path}
              onSelect={() => props.selectFile(file.path, "changes")}
              theme={props.theme}
            />
          ))}
        </box>
      ) : null}

      {props.status?.totalFiles === 0 ? (
        <text content="Working tree clean" fg={props.theme.textMuted} selectable={false} />
      ) : null}
    </box>
  );
}
