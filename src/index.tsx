import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard } from "@opentui/react";

import { DiffPane } from "./diff-pane";
import { createFakeGitClient } from "./fake-client";
import { ReviewProvider, useReviewSession } from "./session";
import { ReviewSidebar } from "./sidebar";
import { ReviewStateProvider, useReviewState } from "./state";
import { ThemeProvider, useTheme } from "./styles/theme";

function App() {
  const theme = useTheme();
  const git = useReviewSession();
  const app = useReviewState();

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
      <ReviewSidebar
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

      <DiffPane
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

const client = process.env.USE_REAL_GIT === "1" ? undefined : createFakeGitClient();

createRoot(renderer as never).render(
  <ThemeProvider>
    <ReviewProvider client={client}>
      <ReviewStateProvider>
        <App />
      </ReviewStateProvider>
    </ReviewProvider>
  </ThemeProvider>,
);
