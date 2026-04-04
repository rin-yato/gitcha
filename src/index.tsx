import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";

import { CodePanel } from "./components/code-panel";
import { SourceControlPanel } from "./components/source-control-panel";
import { AppStateProvider, useAppState } from "./states/app";
import { GitProvider, useGit } from "./states/git";
import { ThemeProvider, useTheme } from "./styles/theme";

function App() {
  const theme = useTheme();
  const git = useGit();
  const app = useAppState();

  useKeyboard((event) => {
    if (event.name === "up" || event.name === "k") app.focusPreviousRow();
    if (event.name === "down" || event.name === "j") app.focusNextRow();
    if (event.name === "space") app.toggleDiffViewMode();
    if (event.name === "r") {
      if (app.viewMode === "compare") {
        git.refreshCompare();
      } else {
        git.refreshStatus();
      }
    }
    if (event.name === "v") app.toggleViewMode();
    if (event.name === "s") app.stageSelectedFile();
    if (event.name === "u") app.unstageSelectedFile();
    if (event.name === "x") app.discardSelectedFile();
    if (event.name === "escape") {
      if (app.viewMode === "compare") {
        app.exitCompareMode();
      } else {
        process.exit(0);
      }
    }
  });

  return (
    <box
      id="app"
      flexDirection="row"
      width="100%"
      height="100%"
      backgroundColor={theme.background}
    >
      <SourceControlPanel
        theme={theme}
        status={git.status}
        error={git.error}
        selectedFile={app.selectedFile}
        focusedPath={app.focusedFile?.path ?? null}
        selectFile={app.selectFile}
        stageSelectedFile={app.stageSelectedFile}
        unstageSelectedFile={app.unstageSelectedFile}
        discardSelectedFile={app.discardSelectedFile}
        refreshStatus={git.refreshStatus}
        viewMode={app.viewMode}
        branchPickerOpen={app.branchPickerOpen}
        branches={git.branches}
        currentBranch={git.status?.branch ?? null}
        compareState={git.compareState}
        selectCompareBranch={app.selectCompareBranch}
        toggleViewMode={app.toggleViewMode}
      />

      <CodePanel
        theme={theme}
        selectedFile={app.selectedFile}
        selectedFileKey={app.selectedFileKey}
        diffContent={app.diffContent}
        diffViewMode={app.diffViewMode}
        toggleDiffViewMode={app.toggleDiffViewMode}
      />
    </box>
  );
}

const renderer = await createCliRenderer();

createRoot(renderer as never).render(
  <ThemeProvider>
    <GitProvider>
      <AppStateProvider>
        <App />
      </AppStateProvider>
    </GitProvider>
  </ThemeProvider>,
);
