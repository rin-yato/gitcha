import { Show } from "solid-js";

import type { FileTreeNode } from "../git";
import type { Theme } from "../styles/theme";

export type FileTreeTheme = Pick<
  Theme,
  | "text"
  | "textMuted"
  | "accent"
  | "added"
  | "removed"
  | "modified"
  | "warning"
  | "surface"
  | "background"
>;

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

function getFileColor(node: FileTreeNode, theme: FileTreeTheme, isSelected: boolean): string {
  if (isSelected) return theme.accent;
  if (!node.fileInfo) return theme.text;

  const status = node.fileInfo.workingTreeStatus;
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

function getStatusSymbol(node: FileTreeNode): string {
  if (!node.fileInfo) return "  ";

  return `${STATUS_SYMBOLS[node.fileInfo.workingTreeStatus] || STATUS_SYMBOLS[node.fileInfo.indexStatus]} `;
}

export function createFileTreeTheme(theme: Theme): FileTreeTheme {
  return {
    background: theme.background,
    text: theme.text,
    textMuted: theme.textMuted,
    accent: theme.accent,
    added: theme.added,
    removed: theme.removed,
    modified: theme.modified,
    warning: theme.warning,
    surface: theme.surface,
  };
}

export function FileTreeItem(props: {
  node: FileTreeNode;
  depth: number;
  isSelected: boolean;
  onSelect: () => void;
  onToggleDirectory: () => void;
  isExpanded: (path: string) => boolean;
  theme: FileTreeTheme;
}) {
  const indent = "  ".repeat(props.depth);
  const rowBackground = () => (props.isSelected ? `${props.theme.accent}22` : undefined);
  const rowForeground = () => (props.isSelected ? props.theme.accent : undefined);

  return (
    <Show
      when={!props.node.isDirectory}
      fallback={
        <box
          ref={(el) => {
            if (el) {
              el.onMouseUp = props.onToggleDirectory;
            }
          }}
          flexDirection="column"
          width="100%"
        >
          <box flexDirection="row" width="100%" backgroundColor={rowBackground()}>
            <text
              content={`${indent}${props.isExpanded(props.node.path) ? "▾" : "▸"} ${props.node.name}`}
              fg={rowForeground() ?? props.theme.textMuted}
              selectable={false}
            />
          </box>
          <Show when={props.isExpanded(props.node.path)}>
            {props.node.children.map((child) => (
              <FileTreeItem
                node={child}
                depth={props.depth + 1}
                isSelected={props.isSelected && child.path === props.node.path}
                onSelect={props.onSelect}
                onToggleDirectory={props.onToggleDirectory}
                isExpanded={props.isExpanded}
                theme={props.theme}
              />
            ))}
          </Show>
        </box>
      }
    >
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
          content={`${indent}${getStatusSymbol(props.node)}${props.node.name}`}
          fg={
            props.isSelected
              ? props.theme.background
              : getFileColor(props.node, props.theme, props.isSelected)
          }
          selectable={true}
        />
      </box>
    </Show>
  );
}
