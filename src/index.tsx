import { render, useKeyboard } from "@opentui/solid";

import { CodePanel } from "./components/code-panel";
import { SourceControlPanel } from "./components/source-control-panel";
import { AppStateProvider, GitProvider, useAppState, useGit } from "./state";
import { ThemeProvider, useTheme } from "./styles/theme";

function App() {
  const theme = useTheme();
  const git = useGit();
  const app = useAppState();

  const status = () => git.status();
  const selectedFile = () => app.selectedFile();
  const focusedFile = () => app.focusedFile();

  useKeyboard((event) => {
    if (event.name === "up" || event.name === "k") app.focusPreviousRow();
    if (event.name === "down" || event.name === "j") app.focusNextRow();
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
      flexDirection="row"
      width="100%"
      height="100%"
      backgroundColor={theme().background}
    >
      <SourceControlPanel
        theme={theme()}
        status={status()}
        error={git.error()}
        selectedFile={selectedFile()}
        focusedPath={focusedFile()?.path ?? null}
        selectFile={app.selectFile}
        stageSelectedFile={app.stageSelectedFile}
        unstageSelectedFile={app.unstageSelectedFile}
        discardSelectedFile={app.discardSelectedFile}
        refreshStatus={git.refreshStatus}
      />

      <CodePanel
        theme={theme()}
        selectedFile={selectedFile()}
        selectedFileKey={app.selectedFileKey()}
        diffContent={app.diffContent()}
        diffViewMode={app.diffViewMode()}
        toggleDiffViewMode={app.toggleDiffViewMode}
      />
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
