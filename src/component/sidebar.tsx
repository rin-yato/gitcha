import type { FileSection, ViewMode } from "../context/changes/state";
import type { Theme } from "../context/theme/provider";
import type { CompareState, GitRepoStatus, GitStatusFile } from "../git";

const STATUS_SYMBOLS: Record<string, string> = {
  A: "+",
  M: "~",
  D: "-",
  R: ">",
  C: "=",
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

function BranchPickerItem(props: {
  branch: string;
  isCurrent: boolean;
  isSelected: boolean;
  onSelect: () => void;
  theme: Theme;
}) {
  return (
    <box
      onMouseUp={props.onSelect}
      flexDirection="row"
      width="100%"
      gap={1}
      backgroundColor={props.isSelected ? `${props.theme.accent}12` : undefined}
    >
      <text
        content={props.isSelected ? `▸ ${props.branch}` : `  ${props.branch}`}
        fg={
          props.isSelected
            ? props.theme.text
            : props.isCurrent
              ? props.theme.accent
              : props.theme.text
        }
        attributes={props.isCurrent ? 1 : 0}
        selectable={true}
      />
      {props.isCurrent ? (
        <text content="(current)" fg={props.theme.textMuted} selectable={false} />
      ) : null}
    </box>
  );
}

export function Sidebar(props: {
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
  // Compare mode props
  viewMode: ViewMode;
  branchPickerOpen: boolean;
  branches: string[];
  currentBranch: string | null;
  compareState: CompareState | null;
  selectCompareBranch: (target: { ref: string; label: string }) => void;
  toggleViewMode: () => void;
  /** Width in characters */
  width: number;
}) {
  const staged = props.status?.files.staged ?? [];
  const changes = [
    ...(props.status?.files.changes ?? []),
    ...(props.status?.files.untracked ?? []),
  ];
  const compareFiles = props.compareState?.files ?? [];

  return (
    <box backgroundColor={props.theme.surface} width={props.width} flexDirection="column">
      {/* Mode header */}
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        {props.viewMode === "staging" ? (
          <text fg={props.theme.text} attributes={1} selectable={false}>
            Staging
          </text>
        ) : (
          <text fg={props.theme.accent} attributes={1} selectable={false}>
            Compare · {props.compareState?.baseLabel ?? "?"}
          </text>
        )}
        <text fg={props.theme.textMuted} selectable={false}>
          {props.viewMode === "staging" ? "[v] compare" : "[v] staging"}
        </text>
      </box>

      {props.error ? (
        <text fg={props.theme.error} selectable={false}>
          {props.error}
        </text>
      ) : null}

      {/* Branch picker (inline when entering compare mode) */}
      {props.viewMode === "compare" && props.branchPickerOpen ? (
        <box flexDirection="column">
          <box flexDirection="row" gap={1} paddingBottom={1}>
            <text
              content="Compare to:"
              fg={props.theme.text}
              attributes={1}
              selectable={false}
            />
          </box>
          {props.branches.map((branch) => (
            <BranchPickerItem
              key={branch}
              branch={branch}
              isCurrent={branch === props.currentBranch}
              isSelected={branch === (props.compareState?.baseRef ?? "")}
              onSelect={() => props.selectCompareBranch({ ref: branch, label: branch })}
              theme={props.theme}
            />
          ))}
          {props.branches.length === 0 ? (
            <text content="No branches found" fg={props.theme.textMuted} selectable={false} />
          ) : null}
        </box>
      ) : null}

      {/* Compare file list */}
      {props.viewMode === "compare" && !props.branchPickerOpen ? (
        compareFiles.length > 0 ? (
          <box flexDirection="column">
            <box flexDirection="row" gap={1}>
              <text content="Changes" fg={props.theme.text} attributes={1} selectable={false} />
              <text
                content={`· ${compareFiles.length}`}
                fg={props.theme.modified}
                selectable={false}
              />
            </box>
            {compareFiles.map((file) => (
              <FlatFileItem
                key={`compare:${file.path}`}
                file={file}
                section="compare"
                isSelected={props.focusedPath === file.path}
                isActive={props.selectedFile === file.path}
                onSelect={() => props.selectFile(file.path, "compare")}
                theme={props.theme}
              />
            ))}
          </box>
        ) : (
          <text
            content={`No changes vs ${props.compareState?.baseLabel ?? "base"}`}
            fg={props.theme.textMuted}
            selectable={false}
          />
        )
      ) : null}

      {/* Staging view */}
      {props.viewMode === "staging" ? (
        <>
          {staged.length > 0 ? (
            <box flexDirection="column">
              <box flexDirection="row" gap={1}>
                <text
                  content="Staged"
                  fg={props.theme.text}
                  attributes={1}
                  selectable={false}
                />
                <text
                  content={`· ${staged.length}`}
                  fg={props.theme.added}
                  selectable={false}
                />
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
                <text
                  content="Changes"
                  fg={props.theme.text}
                  attributes={1}
                  selectable={false}
                />
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
        </>
      ) : null}
    </box>
  );
}
