import { render, useKeyboard } from "@opentui/solid";

import { createMemo } from "solid-js";

import { CommitPanel } from "./components/commit-panel";
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

  const allFiles = createMemo(() => app.allFiles());
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
    if (event.name === "up" || event.name === "k") app.selectPreviousFile();
    if (event.name === "down" || event.name === "j") app.selectNextFile();
    if (event.name === "h") app.toggleDiffViewMode();
    if (event.name === "l") app.toggleDiffViewMode();
    if (event.name === "space") app.toggleDiffViewMode();
    if (event.name === "r") git.refreshStatus();
    if (event.name === "s") app.stageSelectedFile();
    if (event.name === "u") app.unstageSelectedFile();
    if (event.name === "x") app.discardSelectedFile();
    if (event.name === "enter") git.commitChanges(app.commitMessage());
    if (event.name === "p") git.pushChanges();
    if (event.name === "P") git.pullChanges();
    if (event.name === "escape") process.exit(0);
  });

  return (
    <box
      id="app"
      flexDirection="column"
      width="100%"
      height="100%"
      backgroundColor={theme().background}
    >
      <box flexDirection="row" gap={1} paddingBottom={1}>
        <text fg={theme().accent} attributes={1} selectable={false}>
          GitTUIhel
        </text>
        <text fg={theme().textMuted} selectable={false}>
          minimalist source control
        </text>
      </box>

      <box flexDirection="row" flexGrow={1} gap={1}>
        <SourceControlPanel
          theme={theme()}
          status={status()}
          error={git.error()}
          allFiles={allFiles()}
          selectedFile={selectedFile()}
          cursorIndex={app.cursorIndex()}
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

      <box marginTop={1}>
        <CommitPanel
          theme={theme()}
          commitMessage={app.commitMessage}
          setCommitMessage={app.setCommitMessage}
          commitChanges={git.commitChanges}
          pushChanges={git.pushChanges}
          pullChanges={git.pullChanges}
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
