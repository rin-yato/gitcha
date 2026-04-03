import { render, useKeyboard } from "@opentui/solid";

import { createMemo } from "solid-js";

import { DiffPanel } from "./components/diff-panel";
import { SourceControlPanel } from "./components/source-control-panel";
import { buildFileTree } from "./git";
import { AppStateProvider, GitProvider, useAppState, useGit } from "./state";
import { ThemeProvider, useTheme } from "./styles/theme";

function App() {
  const theme = useTheme();
  const git = useGit();
  const app = useAppState();

  const status = () => git.status();
  const selectedFile = () => app.selectedFile();
  const focusedRow = () => app.focusedRow();

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

  useKeyboard((event) => {
    if (event.name === "up" || event.name === "k") app.focusPreviousRow();
    if (event.name === "down" || event.name === "j") app.focusNextRow();
    if (event.name === "enter") app.activateFocusedRow();
    if (event.name === "h") {
      const row = focusedRow();
      if (row?.isDirectory && app.isExpanded(row.path)) {
        app.collapseDirectory(row.path);
      }
    }
    if (event.name === "l") {
      const row = focusedRow();
      if (row?.isDirectory) {
        app.expandDirectory(row.path);
      }
    }
    if (event.name === "space") app.toggleDiffViewMode();
    if (event.name === "r") git.refreshStatus();
    if (event.name === "s") app.stageSelectedFile();
    if (event.name === "u") app.unstageSelectedFile();
    if (event.name === "x") app.discardSelectedFile();
    if (event.name === "escape") process.exit(0);
  });

  return (
    <box
      id="app"
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme().background}
      paddingX={2}
      paddingY={1}
    >
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <box flexDirection="column">
          <text fg={theme().text} attributes={1} selectable={false}>
            Review Workspace
          </text>
          <text fg={theme().textMuted} selectable={false}>
            focused code review
          </text>
        </box>
        <box flexDirection="row" gap={2}>
          <text fg={theme().textMuted} selectable={false}>
            {status()?.branch || "no repository"}
          </text>
          <text fg={theme().accent} selectable={false}>
            {app.diffViewMode()}
          </text>
        </box>
      </box>

      <box flexDirection="row" flexGrow={1} gap={3}>
        <SourceControlPanel
          theme={theme()}
          status={status()}
          error={git.error()}
          visibleRows={app.visibleRows()}
          selectedFile={selectedFile()}
          focusedPath={focusedRow()?.path ?? null}
          focusedRowIndex={app.focusedRowIndex()}
          stagedTree={stagedTree()}
          changesTree={changesTree()}
          untrackedTree={untrackedTree()}
          isExpanded={app.isExpanded}
          toggleDirectory={app.toggleDirectory}
          selectFile={app.selectFile}
          stageSelectedFile={app.stageSelectedFile}
          unstageSelectedFile={app.unstageSelectedFile}
          discardSelectedFile={app.discardSelectedFile}
          refreshStatus={git.refreshStatus}
        />

        <DiffPanel
          theme={theme()}
          selectedFile={selectedFile()}
          diffContent={app.diffContent()}
          diffViewMode={app.diffViewMode()}
          toggleDiffViewMode={app.toggleDiffViewMode}
        />
      </box>
    </box>
  );
}

render(() => (
  <ThemeProvider>
    <GitProvider>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </GitProvider>
  </ThemeProvider>
));
