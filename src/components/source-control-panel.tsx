import { For, Show } from "solid-js";

import type { FileTreeNode, GitRepoStatus } from "../git";
import type { Theme } from "../styles/theme";
import { createFileTreeTheme, FileTreeItem } from "./file-tree-item";

export function SourceControlPanel(props: {
  theme: Theme;
  status: GitRepoStatus | null;
  error: string | null;
  allFiles: { path: string }[];
  selectedFile: string | null;
  cursorIndex: number;
  stagedTree: FileTreeNode | null;
  changesTree: FileTreeNode | null;
  untrackedTree: FileTreeNode | null;
  isExpanded: (path: string) => boolean;
  toggleDirectory: (path: string) => void;
  selectFile: (path: string) => void;
  stageSelectedFile: () => void;
  unstageSelectedFile: () => void;
  discardSelectedFile: () => void;
  refreshStatus: () => void;
}) {
  const fileTreeTheme = createFileTreeTheme(props.theme);

  return (
    <box
      backgroundColor={props.theme.background}
      border
      borderStyle="rounded"
      borderColor={props.theme.border}
      width="36%"
      flexDirection="column"
      padding={1}
    >
      <box flexDirection="row" justifyContent="space-between">
        <text fg={props.theme.accent} attributes={1} selectable={false}>
          SOURCE CONTROL
        </text>
        <text
          content={`[${props.allFiles.length === 0 ? 0 : props.cursorIndex + 1}/${props.allFiles.length}]`}
          fg={props.theme.textMuted}
          selectable={false}
        />
      </box>
      <text content="" />

      <Show when={props.status}>
        {(s: () => GitRepoStatus) => (
          <>
            <box flexDirection="row" gap={1}>
              <text
                content={s().isRepo ? "●" : "○"}
                fg={s().isRepo ? props.theme.success : props.theme.warning}
                selectable={false}
              />
              <text
                content={s().branch || "Not a git repository"}
                fg={props.theme.text}
                selectable={false}
              />
            </box>
            <Show when={s().upstream}>
              <text
                content={`  ${s().aheadCount > 0 ? `↑${s().aheadCount}` : ""}${s().behindCount > 0 ? `↓${s().behindCount}` : ""} ${s().upstream}`}
                fg={props.theme.textMuted}
                selectable={false}
              />
            </Show>
            <text content="" />

            <Show when={s().files.staged.length > 0}>
              <box flexDirection="row" gap={1} paddingBottom={1}>
                <text content="✓" fg={props.theme.added} selectable={false} />
                <text
                  content={`STAGED (${s().files.staged.length})`}
                  fg={props.theme.added}
                  selectable={false}
                />
              </box>
              <For each={props.stagedTree?.children || []}>
                {(node) => (
                  <FileTreeItem
                    node={node}
                    depth={0}
                    isSelected={props.selectedFile === node.path}
                    isExpanded={props.isExpanded}
                    onSelect={() => props.selectFile(node.path)}
                    onToggleDirectory={() => props.toggleDirectory(node.path)}
                    theme={fileTreeTheme}
                  />
                )}
              </For>
              <text content="" />
            </Show>

            <Show when={s().files.changes.length > 0}>
              <box flexDirection="row" gap={1} paddingBottom={1}>
                <text content="~" fg={props.theme.modified} selectable={false} />
                <text
                  content={`CHANGES (${s().files.changes.length})`}
                  fg={props.theme.modified}
                  selectable={false}
                />
              </box>
              <For each={props.changesTree?.children || []}>
                {(node) => (
                  <FileTreeItem
                    node={node}
                    depth={0}
                    isSelected={props.selectedFile === node.path}
                    isExpanded={props.isExpanded}
                    onSelect={() => props.selectFile(node.path)}
                    onToggleDirectory={() => props.toggleDirectory(node.path)}
                    theme={fileTreeTheme}
                  />
                )}
              </For>
              <text content="" />
            </Show>

            <Show when={s().files.untracked.length > 0}>
              <box flexDirection="row" gap={1} paddingBottom={1}>
                <text content="?" fg={props.theme.textMuted} selectable={false} />
                <text
                  content={`UNTRACKED (${s().files.untracked.length})`}
                  fg={props.theme.textMuted}
                  selectable={false}
                />
              </box>
              <For each={props.untrackedTree?.children || []}>
                {(node) => (
                  <FileTreeItem
                    node={node}
                    depth={0}
                    isSelected={props.selectedFile === node.path}
                    isExpanded={props.isExpanded}
                    onSelect={() => props.selectFile(node.path)}
                    onToggleDirectory={() => props.toggleDirectory(node.path)}
                    theme={fileTreeTheme}
                  />
                )}
              </For>
            </Show>

            <Show when={s().totalFiles === 0}>
              <box flexDirection="row" gap={1}>
                <text content="✓" fg={props.theme.success} selectable={false} />
                <text
                  content="Working tree clean"
                  fg={props.theme.success}
                  selectable={false}
                />
              </box>
            </Show>

            <text content="" />
            <box border borderStyle="single" borderColor={props.theme.border} padding={1}>
              <text
                content="j/k or arrows: navigate | h/l: collapse-expand | s/u/x: stage/unstage/discard | r: refresh"
                fg={props.theme.textMuted}
                selectable={false}
              />
            </box>
            <text content="" />
            <box flexDirection="row" gap={1}>
              <text fg={props.theme.textMuted} selectable={false}>
                Selected:
              </text>
              <text fg={props.theme.text} selectable={true}>
                {props.selectedFile || "none"}
              </text>
            </box>
          </>
        )}
      </Show>
    </box>
  );
}
