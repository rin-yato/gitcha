import { For, Show } from "solid-js";

import type { FileTreeNode, GitRepoStatus } from "../git";
import type { VisibleTreeRow } from "../state";
import type { Theme } from "../styles/theme";
import { createFileTreeTheme, FileTreeItem } from "./file-tree-item";

export function SourceControlPanel(props: {
  theme: Theme;
  status: GitRepoStatus | null;
  error: string | null;
  visibleRows: VisibleTreeRow[];
  selectedFile: string | null;
  focusedPath: string | null;
  focusedRowIndex: number;
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
      backgroundColor={props.theme.surface}
      width="32%"
      flexDirection="column"
      paddingX={1}
      paddingY={1}
    >
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <box flexDirection="column">
          <text fg={props.theme.text} attributes={1} selectable={false}>
            Review Queue
          </text>
          <text fg={props.theme.textMuted} selectable={false}>
            files ready for review
          </text>
        </box>
        <text
          content={`${props.visibleRows.length === 0 ? 0 : props.focusedRowIndex + 1}/${props.visibleRows.length}`}
          fg={props.theme.textMuted}
          selectable={false}
        />
      </box>

      <Show when={props.error}>
        <text fg={props.theme.error} selectable={true}>
          {props.error}
        </text>
      </Show>

      <box paddingTop={1} paddingBottom={1}>
        <text fg={props.theme.textMuted} selectable={false}>
          {props.focusedPath || "no file focused"}
        </text>
      </box>

      <Show when={props.status}>
        {(s: () => GitRepoStatus) => (
          <>
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

            <Show when={s().files.staged.length > 0}>
              <box flexDirection="row" gap={1} paddingBottom={1} paddingTop={1}>
                <text
                  content={`Staged · ${s().files.staged.length}`}
                  fg={props.theme.textMuted}
                  selectable={false}
                />
              </box>
              <For each={props.stagedTree?.children || []}>
                {(node) => (
                  <FileTreeItem
                    node={node}
                    depth={0}
                    isSelected={props.focusedPath === node.path}
                    isActive={props.selectedFile === node.path}
                    isExpanded={props.isExpanded}
                    onSelect={() => props.selectFile(node.path)}
                    onToggleDirectory={() => props.toggleDirectory(node.path)}
                    theme={fileTreeTheme}
                  />
                )}
              </For>
            </Show>

            <Show when={s().files.changes.length > 0}>
              <box flexDirection="row" gap={1} paddingBottom={1} paddingTop={1}>
                <text
                  content={`Changes · ${s().files.changes.length}`}
                  fg={props.theme.textMuted}
                  selectable={false}
                />
              </box>
              <For each={props.changesTree?.children || []}>
                {(node) => (
                  <FileTreeItem
                    node={node}
                    depth={0}
                    isSelected={props.focusedPath === node.path}
                    isActive={props.selectedFile === node.path}
                    isExpanded={props.isExpanded}
                    onSelect={() => props.selectFile(node.path)}
                    onToggleDirectory={() => props.toggleDirectory(node.path)}
                    theme={fileTreeTheme}
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
              <For each={props.untrackedTree?.children || []}>
                {(node) => (
                  <FileTreeItem
                    node={node}
                    depth={0}
                    isSelected={props.focusedPath === node.path}
                    isActive={props.selectedFile === node.path}
                    isExpanded={props.isExpanded}
                    onSelect={() => props.selectFile(node.path)}
                    onToggleDirectory={() => props.toggleDirectory(node.path)}
                    theme={fileTreeTheme}
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

            <box paddingTop={2}>
              <text
                content="j/k move  space toggle diff  s/u/x act  r refresh"
                fg={props.theme.textMuted}
                selectable={false}
              />
            </box>
          </>
        )}
      </Show>
    </box>
  );
}
