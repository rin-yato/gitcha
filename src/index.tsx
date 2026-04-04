import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";

import { useCallback } from "react";

import type { CommandOption } from "./component/dialog-command";
import { DialogCommand } from "./component/dialog-command";
import { DiffPane } from "./component/diff-pane";
import { Sidebar } from "./component/sidebar";
import { createFakeGitClient } from "./context/changes/fake-client";
import { ReviewProvider, useReviewSession } from "./context/changes/session";
import { ReviewStateProvider, useReviewState } from "./context/changes/state";
import { ThemeProvider, useTheme } from "./context/theme/provider";
import { DialogProvider, useDialog } from "./ui/dialog";
import { Overlay } from "./ui/overlay";
import { Toast, ToastProvider } from "./ui/toast";

function App() {
  const renderer = useRenderer();
  const theme = useTheme();
  const git = useReviewSession();
  const app = useReviewState();
  const dialog = useDialog();

  const showCommandPalette = useCallback(() => {
    const commands: CommandOption[] = [
      {
        id: "toggle-compare",
        label: "Toggle Compare Mode",
        description: "Switch between staging and compare views",
        category: "View",
        keybind: "v",
        run: () => app.toggleViewMode(),
      },
      {
        id: "refresh",
        label: "Refresh",
        description: "Reload git status or compare diff",
        category: "Action",
        keybind: "r",
        run: () => {
          if (app.viewMode === "compare") git.refreshCompare();
          else git.refreshStatus();
        },
      },
      {
        id: "toggle-diff-view",
        label: "Toggle Diff View",
        description: "Switch between unified and split diff",
        category: "View",
        keybind: "space",
        run: () => app.toggleDiffViewMode(),
      },
      {
        id: "exit-compare",
        label: "Exit Compare Mode",
        description: "Return to staging view",
        category: "View",
        run: () => app.exitCompareMode(),
      },
      {
        id: "stage-file",
        label: "Stage File",
        description: "Stage the currently selected file",
        category: "Action",
        keybind: "s",
        run: () => app.stageSelectedFile(),
      },
      {
        id: "unstage-file",
        label: "Unstage File",
        description: "Unstage the currently selected file",
        category: "Action",
        keybind: "u",
        run: () => app.unstageSelectedFile(),
      },
      {
        id: "discard-file",
        label: "Discard Changes",
        description: "Discard changes in the currently selected file",
        category: "Action",
        keybind: "x",
        run: () => app.discardSelectedFile(),
      },
      {
        id: "shrink-sidebar",
        label: "Shrink Sidebar",
        description: "Make the sidebar narrower",
        category: "Layout",
        keybind: "[",
        run: () => app.shrinkSidebar(),
      },
      {
        id: "grow-sidebar",
        label: "Grow Sidebar",
        description: "Make the sidebar wider",
        category: "Layout",
        keybind: "]",
        run: () => app.growSidebar(),
      },
    ];

    const suggested = commands.filter((cmd) =>
      ["refresh", "toggle-compare", "toggle-diff-view"].includes(cmd.id),
    );

    dialog.replace(
      <Overlay backgroundColor={`${theme.background}cc`}>
        <DialogCommand theme={theme} options={commands} suggested={suggested} />
      </Overlay>,
    );
  }, [app, git, theme, dialog]);

  useKeyboard((event) => {
    // Don't handle if dialog is open
    if (dialog.stack.length > 0) return;

    // Open command palette
    if (event.name === "/") {
      showCommandPalette();
      return;
    }

    // Navigation
    if (event.name === "up" || event.name === "k") app.focusPreviousRow();
    if (event.name === "down" || event.name === "j") app.focusNextRow();

    // Diff view
    if (event.name === "space") app.toggleDiffViewMode();

    // Refresh
    if (event.name === "r") {
      if (app.viewMode === "compare") {
        git.refreshCompare();
      } else {
        git.refreshStatus();
      }
    }

    // View mode
    if (event.name === "v") app.toggleViewMode();

    // File actions
    if (event.name === "s") app.stageSelectedFile();
    if (event.name === "u") app.unstageSelectedFile();
    if (event.name === "x") app.discardSelectedFile();

    // Layout
    if (event.name === "[") app.shrinkSidebar();
    if (event.name === "]") app.growSidebar();

    // Exit
    if (event.name === "escape") {
      if (app.viewMode === "compare") {
        app.exitCompareMode();
      } else {
        renderer.destroy();
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
      <Sidebar
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
        width={app.sidebarWidth}
      />

      <DiffPane
        theme={theme}
        selectedFile={app.selectedFile}
        selectedFileKey={app.selectedFileKey}
        diffContent={app.diffContent}
        diffViewMode={app.diffViewMode}
        toggleDiffViewMode={app.toggleDiffViewMode}
      />

      <Toast theme={theme} />
    </box>
  );
}

const renderer = await createCliRenderer();

const client = process.env.USE_REAL_GIT === "1" ? undefined : createFakeGitClient();

createRoot(renderer as never).render(
  <ThemeProvider>
    <ReviewProvider client={client}>
      <ReviewStateProvider>
        <DialogProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </DialogProvider>
      </ReviewStateProvider>
    </ReviewProvider>
  </ThemeProvider>,
);
