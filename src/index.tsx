#!/usr/bin/env bun

import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";

import { useCallback } from "react";

import { createFakeGitClient } from "@/context/changes/fake-client";
import { ReviewProvider, useReviewSession } from "@/context/changes/session";
import { ReviewStateProvider, useReviewState } from "@/context/changes/state";
import { ThemeProvider, useTheme } from "@/context/theme/provider";

import type { CommandOption } from "@/component/dialog-command";
import { DialogCommand } from "@/component/dialog-command";
import { CompareBranchDialog } from "@/component/dialog-compare-branch";
import { DiffPane } from "@/component/diff-pane";
import { Sidebar } from "@/component/sidebar/index";
import { DialogProvider, useDialog } from "@/component/ui/dialog";
import type { DialogSelectOption } from "@/component/ui/dialog-select";
import { Toast, ToastProvider } from "@/component/ui/toast";

function App() {
  const renderer = useRenderer();
  const theme = useTheme();
  const git = useReviewSession();
  const app = useReviewState();
  const dialog = useDialog();
  const isFakeGit = process.env.USE_FAKE_GIT === "1";

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
      {
        id: "toggle-sidebar",
        label: "Toggle Sidebar",
        category: "Layout",
        slash: "\\",
        run: () => app.toggleSidebar(),
      },
    ];

    if (isFakeGit) {
      commands.push(
        { id: "fake-scroll-1", label: "Fake Scroll 1", category: "Debug", run: () => {} },
        { id: "fake-scroll-2", label: "Fake Scroll 2", category: "Debug", run: () => {} },
        { id: "fake-scroll-3", label: "Fake Scroll 3", category: "Debug", run: () => {} },
        { id: "fake-scroll-4", label: "Fake Scroll 4", category: "Debug", run: () => {} },
        { id: "fake-scroll-5", label: "Fake Scroll 5", category: "Debug", run: () => {} },
        { id: "fake-scroll-6", label: "Fake Scroll 6", category: "Debug", run: () => {} },
        { id: "fake-scroll-7", label: "Fake Scroll 7", category: "Debug", run: () => {} },
        { id: "fake-scroll-8", label: "Fake Scroll 8", category: "Debug", run: () => {} },
        { id: "fake-scroll-9", label: "Fake Scroll 9", category: "Debug", run: () => {} },
        { id: "fake-scroll-10", label: "Fake Scroll 10", category: "Debug", run: () => {} },
      );
    }

    const commandsMap = Object.fromEntries(commands.map((cmd) => [cmd.id, cmd]));

    const suggestedCmds = commands.filter((cmd) =>
      ["refresh", "toggle-compare", "toggle-diff-view"].includes(cmd.id),
    );

    const categories = isFakeGit
      ? (["View", "Action", "Layout", "Debug"] as const)
      : (["View", "Action", "Layout"] as const);

    const selectOptions = [
      ...suggestedCmds.map((cmd) => ({
        title: cmd.label,
        value: cmd.id,
        description: cmd.slash,
        category: "Suggested",
      })),
      ...categories.flatMap((cat) =>
        commands
          .filter((cmd) => cmd.category === cat)
          .map((cmd) => ({
            title: cmd.label,
            value: cmd.id,
            description: cmd.slash,
            category: cat,
          })),
      ),
    ] satisfies DialogSelectOption<string>[];

    dialog.replace(
      <DialogCommand theme={theme} options={selectOptions} commands={commandsMap} />,
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
    if (event.name === "\\") app.toggleSidebar();

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
        selectedFileKey={app.selectedFileKey}
        focusedFileKey={app.focusedFileKey}
        selectFile={app.selectFile}
        viewMode={app.viewMode}
        compareState={git.compareState}
        isOpen={app.isSidebarOpen}
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
