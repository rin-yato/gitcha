#!/usr/bin/env bun
import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";

import { useCallback } from "react";

import type { CommandOption } from "./component/dialog-command";
import { DialogCommand } from "./component/dialog-command";
import { CompareBranchDialog } from "./component/dialog-compare-branch";
import { DiffPane } from "./component/diff-pane";
import { Sidebar } from "./component/sidebar/index";
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
        label: "Compare",
        category: "View",
        slash: "v",
        run: () => showCompareBranchDialog(),
      },
      {
        id: "refresh",
        label: "Refresh",
        category: "Action",
        slash: "r",
        run: () => {
          if (app.viewMode === "compare") git.refreshCompare();
          else git.refreshStatus();
        },
      },
      {
        id: "toggle-diff-view",
        label: "Diff View",
        category: "View",
        slash: "space",
        run: () => app.toggleDiffViewMode(),
      },
      {
        id: "exit-compare",
        label: "Exit Compare",
        category: "View",
        run: () => app.exitCompareMode(),
      },
      {
        id: "stage-file",
        label: "Stage",
        category: "Action",
        slash: "s",
        run: () => app.stageSelectedFile(),
      },
      {
        id: "unstage-file",
        label: "Unstage",
        category: "Action",
        slash: "u",
        run: () => app.unstageSelectedFile(),
      },
      {
        id: "discard-file",
        label: "Discard",
        category: "Action",
        slash: "x",
        run: () => app.discardSelectedFile(),
      },
      {
        id: "shrink-sidebar",
        label: "Narrow Sidebar",
        category: "Layout",
        slash: "[",
        run: () => app.shrinkSidebar(),
      },
      {
        id: "grow-sidebar",
        label: "Wider Sidebar",
        category: "Layout",
        slash: "]",
        run: () => app.growSidebar(),
      },
    ];

    const commandsMap = Object.fromEntries(commands.map((cmd) => [cmd.id, cmd]));

    const suggestedCmds = commands.filter((cmd) =>
      ["refresh", "toggle-compare", "toggle-diff-view"].includes(cmd.id),
    );

    const selectOptions = [
      {
        group: "Suggested",
        options: suggestedCmds.map((cmd) => ({
          id: cmd.id,
          title: cmd.label,
          description: cmd.slash,
        })),
      },
      ...(["View", "Action", "Layout"] as const).map((cat) => ({
        group: cat,
        options: commands
          .filter((cmd) => cmd.category === cat)
          .map((cmd) => ({
            id: cmd.id,
            title: cmd.label,
            description: cmd.slash,
          })),
      })),
    ];

    dialog.replace(
      <Overlay backgroundColor="#00000088">
        <DialogCommand theme={theme} options={selectOptions} commands={commandsMap} />
      </Overlay>,
    );
  }, [app, git, theme, dialog]);

  const showCompareBranchDialog = useCallback(() => {
    dialog.replace(
      <CompareBranchDialog
        theme={theme}
        branches={git.branches}
        currentBranch={git.status?.branch ?? null}
        defaultCompareTarget={
          git.compareState?.baseRef
            ? { ref: git.compareState.baseRef, label: git.compareState.baseLabel }
            : git.defaultCompareTarget
        }
        onSelect={(target) => {
          dialog.clear();
          app.enterCompareMode(target);
        }}
        onClose={() => dialog.clear()}
      />,
    );
  }, [
    dialog,
    theme,
    git.branches,
    git.status?.branch,
    git.compareState,
    git.defaultCompareTarget,
    app,
  ]);

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

    // View mode - always open dialog to select compare branch
    if (event.name === "v") {
      showCompareBranchDialog();
    }

    // File actions
    if (event.name === "s") app.stageSelectedFile();
    if (event.name === "u") app.unstageSelectedFile();
    if (event.name === "x") app.discardSelectedFile();

    // Layout
    if (event.name === "[") app.shrinkSidebar();
    if (event.name === "]") app.growSidebar();

    // Exit
    if (event.name === "escape" && app.viewMode === "compare") {
      app.exitCompareMode();
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
        selectedFileKey={app.selectedFileKey}
        focusedFileKey={app.focusedFileKey}
        selectFile={app.selectFile}
        viewMode={app.viewMode}
        compareState={git.compareState}
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

const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  autoFocus: false,
  externalOutputMode: "passthrough",
  gatherStats: false,
  maxFps: 60,
  onDestroy: () => {
    process.exit(0);
  },
});

renderer.keyInput.on("keypress", (key) => {
  // Toggle with backtick key
  if (key.name === "`") {
    renderer.console.toggle();
  }

  // Or with a modifier
  if (key.ctrl && key.name === "l") {
    renderer.console.toggle();
  }

  // handle copy selection
  if (key.name === "y" && key.ctrl) {
    renderer.copyToClipboardOSC52(renderer.getSelection()?.getSelectedText() ?? "");
  }

  if (key.name === "c" && key.ctrl) {
    renderer.destroy();
    process.exit(0);
  }
});

const client = process.env.USE_FAKE_GIT === "1" ? createFakeGitClient() : undefined;

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
