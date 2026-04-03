import { RGBA, SyntaxStyle } from "@opentui/core";
import { render, useKeyboard, useRenderer, useSelectionHandler } from "@opentui/solid";

import { createMemo, createSignal, For, onMount, Show } from "solid-js";

import {
  buildFileTree,
  type FileTreeNode,
  type GitRepoStatus,
  type GitStatusFile,
  getFileDiff,
  getRepoStatus,
} from "./git";
import { ThemeProvider, useTheme } from "./styles/theme";

// Status symbols and colors
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

// File Tree Item Component with interactivity
function FileTreeItem(props: {
  node: FileTreeNode;
  depth: number;
  isSelected: boolean;
  onSelect: () => void;
  theme: {
    text: string;
    textMuted: string;
    accent: string;
    added: string;
    removed: string;
    modified: string;
    warning: string;
    surface: string;
  };
}) {
  const theme = props.theme;
  const indent = "  ".repeat(props.depth);
  const rowBackground = props.isSelected ? `${theme.accent}22` : undefined;
  const rowForeground = props.isSelected ? theme.accent : undefined;

  const getFileColor = () => {
    if (props.isSelected) return theme.accent;
    if (!props.node.fileInfo) return theme.text;

    const status = props.node.fileInfo.workingTreeStatus;
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
  };

  return (
    <Show
      when={!props.node.isDirectory}
      fallback={
        <>
          <box flexDirection="row" width="100%" backgroundColor={rowBackground}>
            <text
              content={`${indent}▸ ${props.node.name}`}
              fg={rowForeground ?? theme.textMuted}
              selectable={false}
            />
          </box>
          <For each={props.node.children}>
            {(child) => (
              <FileTreeItem
                node={child}
                depth={props.depth + 1}
                isSelected={props.isSelected && child.path === props.node.path}
                onSelect={props.onSelect}
                theme={theme}
              />
            )}
          </For>
        </>
      }
    >
      <box
        flexDirection="row"
        width="100%"
        backgroundColor={rowBackground}
        onMouseUp={props.onSelect}
      >
        <text
          content={`${indent}${props.node.fileInfo ? `${STATUS_SYMBOLS[props.node.fileInfo.workingTreeStatus] || STATUS_SYMBOLS[props.node.fileInfo.indexStatus]} ` : "  "}${props.node.name}`}
          fg={props.isSelected ? theme.text : getFileColor()}
          selectable={true}
        />
      </box>
    </Show>
  );
}

// Main App component
function App() {
  const theme = useTheme();
  const [status, setStatus] = createSignal<GitRepoStatus | null>(null);
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [diffContent, setDiffContent] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [cursorIndex, setCursorIndex] = createSignal(0);

  // Load git status
  const loadStatus = () => {
    try {
      const repoStatus = getRepoStatus();
      setStatus(repoStatus);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load git status");
      setStatus(null);
    }
  };

  // Load diff for selected file
  const loadDiff = (filePath: string) => {
    try {
      const s = status();
      if (!s) return;

      // Check if file is staged to show staged diff
      const isStaged = s.files.staged.some((f) => f.path === filePath);
      const diff = getFileDiff(filePath, { staged: isStaged });
      setDiffContent(diff || "No changes to display");
    } catch (e) {
      setDiffContent(`Error loading diff: ${e instanceof Error ? e.message : "Unknown error"}`);
    }
  };

  // Initial load
  onMount(() => {
    loadStatus();
    // Refresh every 2 seconds
    setInterval(loadStatus, 2000);
  });

  // Get all flat files for navigation
  const allFiles = createMemo(() => {
    const s = status();
    if (!s) return [];

    const all = [...s.files.staged, ...s.files.changes, ...s.files.untracked];
    return all;
  });

  // Handle file selection
  const handleSelect = (path: string) => {
    setSelectedFile(path);
    loadDiff(path);
    // Update cursor index
    const index = allFiles().findIndex((f) => f.path === path);
    if (index !== -1) {
      setCursorIndex(index);
    }
  };

  // Keyboard navigation
  useKeyboard((event) => {
    if (event.name === "up" || event.name === "k") {
      const newIndex = Math.max(0, cursorIndex() - 1);
      setCursorIndex(newIndex);
      const file = allFiles()[newIndex];
      if (file) {
        handleSelect(file.path);
      }
      return;
    }

    if (event.name === "down" || event.name === "j") {
      const newIndex = Math.min(allFiles().length - 1, cursorIndex() + 1);
      setCursorIndex(newIndex);
      const file = allFiles()[newIndex];
      if (file) {
        handleSelect(file.path);
      }
      return;
    }

    if (event.name === "r") {
      loadStatus();
      return;
    }

    if (event.name === "escape") {
      process.exit(0);
    }
  });

  // Build file trees
  const stagedTree = createMemo(() => {
    const s = status();
    return s ? buildFileTree(s.files.staged) : null;
  });

  const changesTree = createMemo(() => {
    const s = status();
    return s ? buildFileTree(s.files.changes) : null;
  });

  const untrackedTree = createMemo(() => {
    const s = status();
    return s ? buildFileTree(s.files.untracked) : null;
  });

  return (
    <box
      id="app"
      flexDirection="row"
      width="100%"
      height="100%"
      backgroundColor={theme().background}
    >
      {/* Left Sidebar - Source Control Panel */}
      <box
        id="sidebar"
        backgroundColor={theme().background}
        border
        borderStyle="rounded"
        borderColor={theme().border}
        width="45%"
        flexDirection="column"
        padding={1}
      >
        {/* Header */}
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme().accent} attributes={1} selectable={false}>
            GIT STATUS
          </text>
          <text
            content={`[${cursorIndex() + 1}/${allFiles().length}]`}
            fg={theme().textMuted}
            selectable={false}
          />
        </box>
        <text content="" />

        <Show when={error()}>
          <box
            padding={1}
            backgroundColor={`${theme().error}20`}
            border
            borderStyle="single"
            borderColor={theme().error}
          >
            <text content={`! ${error()}`} fg={theme().error} selectable={true} />
          </box>
          <text content="" />
        </Show>

        <Show when={status()}>
          {(s: () => GitRepoStatus) => (
            <scrollbox flexGrow={1}>
              {/* Branch Info */}
              <box flexDirection="row" gap={1}>
                <text
                  content={s().isRepo ? "●" : "○"}
                  fg={s().isRepo ? theme().success : theme().warning}
                  selectable={false}
                />
                <text
                  content={s().branch || "Not a git repository"}
                  fg={theme().text}
                  attributes={1}
                  selectable={false}
                />
              </box>
              <Show when={s().upstream}>
                <text
                  content={`  ${s().aheadCount > 0 ? `↑${s().aheadCount}` : ""}${s().behindCount > 0 ? `↓${s().behindCount}` : ""} ${s().upstream}`}
                  fg={theme().textMuted}
                  selectable={false}
                />
              </Show>
              <text content="" />

              {/* Staged Changes */}
              <Show when={s().files.staged.length > 0}>
                <box flexDirection="row" gap={1} paddingBottom={1}>
                  <text content="✓" fg={theme().added} selectable={false} />
                  <text
                    content={`STAGED (${s().files.staged.length})`}
                    fg={theme().added}
                    attributes={1}
                    selectable={false}
                  />
                </box>
                <For each={stagedTree()?.children || []}>
                  {(node) => (
                    <FileTreeItem
                      node={node}
                      depth={0}
                      isSelected={selectedFile() === node.path}
                      onSelect={() => handleSelect(node.path)}
                      theme={{
                        text: theme().text,
                        textMuted: theme().textMuted,
                        accent: theme().accent,
                        added: theme().added,
                        removed: theme().removed,
                        modified: theme().modified,
                        warning: theme().warning,
                        surface: theme().surface,
                      }}
                    />
                  )}
                </For>
                <text content="" />
              </Show>

              {/* Changes */}
              <Show when={s().files.changes.length > 0}>
                <box flexDirection="row" gap={1} paddingBottom={1}>
                  <text content="~" fg={theme().modified} selectable={false} />
                  <text
                    content={`CHANGES (${s().files.changes.length})`}
                    fg={theme().modified}
                    attributes={1}
                    selectable={false}
                  />
                </box>
                <For each={changesTree()?.children || []}>
                  {(node) => (
                    <FileTreeItem
                      node={node}
                      depth={0}
                      isSelected={selectedFile() === node.path}
                      onSelect={() => handleSelect(node.path)}
                      theme={{
                        text: theme().text,
                        textMuted: theme().textMuted,
                        accent: theme().accent,
                        added: theme().added,
                        removed: theme().removed,
                        modified: theme().modified,
                        warning: theme().warning,
                        surface: theme().surface,
                      }}
                    />
                  )}
                </For>
                <text content="" />
              </Show>

              {/* Untracked Files */}
              <Show when={s().files.untracked.length > 0}>
                <box flexDirection="row" gap={1} paddingBottom={1}>
                  <text content="?" fg={theme().textMuted} selectable={false} />
                  <text
                    content={`UNTRACKED (${s().files.untracked.length})`}
                    fg={theme().textMuted}
                    attributes={1}
                    selectable={false}
                  />
                </box>
                <For each={untrackedTree()?.children || []}>
                  {(node) => (
                    <FileTreeItem
                      node={node}
                      depth={0}
                      isSelected={selectedFile() === node.path}
                      onSelect={() => handleSelect(node.path)}
                      theme={{
                        text: theme().text,
                        textMuted: theme().textMuted,
                        accent: theme().accent,
                        added: theme().added,
                        removed: theme().removed,
                        modified: theme().modified,
                        warning: theme().warning,
                        surface: theme().surface,
                      }}
                    />
                  )}
                </For>
              </Show>

              {/* Empty State */}
              <Show when={s().totalFiles === 0}>
                <box flexDirection="row" gap={1}>
                  <text content="✓" fg={theme().success} selectable={false} />
                  <text content="Working tree clean" fg={theme().success} selectable={false} />
                </box>
              </Show>

              {/* Help */}
              <text content="" />
              <text content="" />
              <box border borderStyle="single" borderColor={theme().border} padding={1}>
                <text
                  content="↑/↓ or j/k: Navigate  |  Enter: Select  |  r: Refresh  |  ESC: Exit"
                  fg={theme().textMuted}
                  selectable={false}
                />
              </box>
            </scrollbox>
          )}
        </Show>
      </box>

      {/* Right Panel - Diff View */}
      <box
        id="diff-panel"
        backgroundColor={theme().background}
        border
        borderStyle="rounded"
        borderColor={theme().border}
        flexGrow={1}
        flexDirection="column"
        padding={1}
      >
        <Show
          when={selectedFile()}
          fallback={
            <box
              flexDirection="column"
              flexGrow={1}
              justifyContent="center"
              alignItems="center"
            >
              <text content="📄" fg={theme().textMuted} selectable={false} />
              <text content="" />
              <text
                content="Select a file to view diff"
                fg={theme().textMuted}
                selectable={false}
              />
            </box>
          }
        >
          {(file: () => string) => (
            <>
              {/* File Header */}
              <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
                <text
                  content={`📄 ${file()}`}
                  fg={theme().text}
                  attributes={1}
                  selectable={true}
                />
                <Show when={diffContent()}>
                  <text
                    content="Click to select/copy"
                    fg={theme().textMuted}
                    selectable={false}
                  />
                </Show>
              </box>

              {/* Diff Content */}
              <Show
                when={diffContent()}
                fallback={
                  <text content="Loading diff..." fg={theme().textMuted} selectable={false} />
                }
              >
                {(diff: () => string) => (
                  <scrollbox flexGrow={1}>
                    <text content={diff()} fg={theme().text} selectable={true} />
                  </scrollbox>
                )}
              </Show>
            </>
          )}
        </Show>
      </box>
    </box>
  );
}

render(() => (
  <ThemeProvider>
    <App />
  </ThemeProvider>
));
