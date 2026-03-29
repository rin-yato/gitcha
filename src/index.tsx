import { render } from "@opentui/solid";

import { createMemo, createSignal, For, Show } from "solid-js";

import { buildFileTree, type FileTreeNode, type GitRepoStatus, getRepoStatus } from "./git";
import { ThemeProvider, useTheme } from "./styles/theme";

// Status indicator characters
const STATUS_ICONS: Record<string, string> = {
  A: "A", // Added
  M: "M", // Modified
  D: "D", // Deleted
  R: "R", // Renamed
  C: "C", // Copied
  U: "U", // Updated but unmerged
  "?": "?", // Untracked
  " ": " ", // Unchanged
};

// Get color based on file status
function getStatusColor(
  status: string,
  theme: {
    text: string;
    textMuted: string;
    accent: string;
    added: string;
    removed: string;
    modified: string;
    warning: string;
    error: string;
  },
): string {
  switch (status) {
    case "A":
      return theme.added;
    case "M":
      return theme.modified;
    case "D":
      return theme.removed;
    case "R":
      return theme.warning;
    case "C":
      return theme.accent;
    case "U":
      return theme.warning;
    case "?":
      return theme.textMuted;
    default:
      return theme.text;
  }
}

// Render a file tree node recursively
function FileTreeItem(props: {
  node: FileTreeNode;
  depth: number;
  theme: {
    text: string;
    textMuted: string;
    accent: string;
    added: string;
    removed: string;
    modified: string;
    warning: string;
    error: string;
  };
  selectedPath: string;
  onSelect: (path: string) => void;
}) {
  const theme = props.theme;
  const indent = "  ".repeat(props.depth);

  const _handleClick = () => {
    if (!props.node.isDirectory) {
      props.onSelect(props.node.path);
    }
  };

  return (
    <Show
      when={!props.node.isDirectory}
      fallback={
        <>
          <text content={`${indent}📁 ${props.node.name}/`} fg={theme.text} />
          <For each={props.node.children}>
            {(child) => (
              <FileTreeItem
                node={child}
                depth={props.depth + 1}
                theme={theme}
                selectedPath={props.selectedPath}
                onSelect={props.onSelect}
              />
            )}
          </For>
        </>
      }
    >
      <text
        content={`${indent}${props.node.fileInfo ? `[${STATUS_ICONS[props.node.fileInfo.workingTreeStatus] || props.node.fileInfo.indexStatus}] ` : ""}${props.node.name}`}
        fg={
          props.selectedPath === props.node.path
            ? theme.accent
            : getStatusColor(props.node.fileInfo?.workingTreeStatus || " ", theme)
        }
      />
    </Show>
  );
}

// Main App component
function App() {
  const theme = useTheme();
  const [status, setStatus] = createSignal<GitRepoStatus | null>(null);
  const [selectedFile, setSelectedFile] = createSignal<string | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  // Load git status on mount
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

  // Initial load
  loadStatus();

  // Refresh every 2 seconds
  setInterval(loadStatus, 2000);

  // Build file trees for each category
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
    <box id="app" flexDirection="row" width="100%" height="100%">
      {/* Left Sidebar - Source Control Panel */}
      <box
        id="sidebar"
        backgroundColor={theme().surface}
        border
        borderStyle="single"
        borderColor={theme().border}
        width="40%"
        flexDirection="column"
        padding={1}
      >
        {/* Header */}
        <text id="sidebar-title" content="SOURCE CONTROL" fg={theme().accent} />
        <text content="" />

        <Show when={error()}>
          <text content={`Error: ${error()}`} fg={theme().error} />
        </Show>

        <Show when={status()}>
          {(s: () => GitRepoStatus) => (
            <>
              {/* Branch Info */}
              <text
                content={`${s().isRepo ? "🌿" : "⚠️"} ${s().branch || "Not a git repo"}`}
                fg={theme().text}
              />
              <Show when={s().upstream}>
                <text
                  content={`  ↑ ${s().aheadCount} ↓ ${s().behindCount} ${s().upstream}`}
                  fg={theme().textMuted}
                />
              </Show>
              <text content="" />

              {/* Staged Changes */}
              <Show when={s().files.staged.length > 0}>
                <text
                  content={`STAGED CHANGES (${s().files.staged.length})`}
                  fg={theme().accent}
                />
                <For each={stagedTree()?.children || []}>
                  {(node) => (
                    <FileTreeItem
                      node={node}
                      depth={0}
                      theme={{
                        text: theme().text,
                        textMuted: theme().textMuted,
                        accent: theme().accent,
                        added: theme().added,
                        removed: theme().removed,
                        modified: theme().modified,
                        warning: theme().warning,
                        error: theme().error,
                      }}
                      selectedPath={selectedFile() || ""}
                      onSelect={setSelectedFile}
                    />
                  )}
                </For>
                <text content="" />
              </Show>

              {/* Changes */}
              <Show when={s().files.changes.length > 0}>
                <text content={`CHANGES (${s().files.changes.length})`} fg={theme().accent} />
                <For each={changesTree()?.children || []}>
                  {(node) => (
                    <FileTreeItem
                      node={node}
                      depth={0}
                      theme={{
                        text: theme().text,
                        textMuted: theme().textMuted,
                        accent: theme().accent,
                        added: theme().added,
                        removed: theme().removed,
                        modified: theme().modified,
                        warning: theme().warning,
                        error: theme().error,
                      }}
                      selectedPath={selectedFile() || ""}
                      onSelect={setSelectedFile}
                    />
                  )}
                </For>
                <text content="" />
              </Show>

              {/* Untracked Files */}
              <Show when={s().files.untracked.length > 0}>
                <text
                  content={`UNTRACKED FILES (${s().files.untracked.length})`}
                  fg={theme().textMuted}
                />
                <For each={untrackedTree()?.children || []}>
                  {(node) => (
                    <FileTreeItem
                      node={node}
                      depth={0}
                      theme={{
                        text: theme().text,
                        textMuted: theme().textMuted,
                        accent: theme().accent,
                        added: theme().added,
                        removed: theme().removed,
                        modified: theme().modified,
                        warning: theme().warning,
                        error: theme().error,
                      }}
                      selectedPath={selectedFile() || ""}
                      onSelect={setSelectedFile}
                    />
                  )}
                </For>
              </Show>

              {/* Empty State */}
              <Show when={s().totalFiles === 0}>
                <text content="✓ Working tree clean" fg={theme().success} />
              </Show>

              {/* Keyboard Shortcuts */}
              <text content="" />
              <text content="" />
              <text content="[r] Refresh" fg={theme().textMuted} />
            </>
          )}
        </Show>
      </box>

      {/* Right Panel - Diff View */}
      <box
        id="diff-panel"
        border
        borderStyle="single"
        borderColor={theme().border}
        flexGrow={1}
        flexDirection="column"
        padding={1}
      >
        <text id="diff-title" content="DIFF VIEW" fg={theme().accent} />
        <text content="" />

        <Show when={!selectedFile()}>
          <text content="Select a file to view changes" fg={theme().textMuted} />
        </Show>

        <Show when={selectedFile()}>
          {(file: () => string) => (
            <>
              <text content={`📄 ${file()}`} fg={theme().text} />
              <text content="" />
              <text
                content="Diff content will be displayed here in Phase 3..."
                fg={theme().textMuted}
              />
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
