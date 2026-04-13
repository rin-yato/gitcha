import { useKeyboard, useRenderer } from "@opentui/react";

import { useCallback, useEffect, useState } from "react";

import { createFakeGitClient } from "@/context/changes/fake-client";
import { ReviewProvider, useReviewSession } from "@/context/changes/session";
import { ReviewStateProvider, useReviewState } from "@/context/changes/state";
import { type ThemeMode, ThemeProvider, useTheme } from "@/context/theme/provider";

import { DialogCommand } from "@/component/dialog-command";
import { CompareBranchDialog } from "@/component/dialog-compare-branch";
import { ThemeDialog } from "@/component/dialog-theme";
import { DiffPane } from "@/component/diff-pane";
import { Sidebar } from "@/component/sidebar/index";
import { DialogProvider, useDialog } from "@/component/ui/dialog";
import { Toast, ToastProvider } from "@/component/ui/toast";

import {
  buildCommandMap,
  buildCommandOptions,
  buildCommandSelectOptions,
} from "@/component/app-commands";

function App() {
  const renderer = useRenderer();
  const theme = useTheme();
  const git = useReviewSession();
  const app = useReviewState();
  const dialog = useDialog();

  const refresh = useCallback(() => {
    if (app.viewMode === "compare") {
      git.refreshCompare();
      return;
    }

    git.refreshStatus();
  }, [app.viewMode, git]);

  const showThemeDialog = useCallback(() => {
    dialog.replace(<ThemeDialog theme={theme} onClose={() => dialog.clear()} />);
  }, [dialog, theme]);

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

  const showCommandPalette = useCallback(() => {
    const commands = buildCommandOptions({
      refresh,
      showCompareBranchDialog,
      showThemeDialog,
      app,
    });

    dialog.replace(
      <DialogCommand
        theme={theme}
        options={buildCommandSelectOptions(commands)}
        commands={buildCommandMap(commands)}
      />,
    );
  }, [app, dialog, refresh, showCompareBranchDialog, showThemeDialog, theme]);

  useKeyboard((event) => {
    if (dialog.stack.length > 0) return;

    switch (event.name) {
      case "/":
        showCommandPalette();
        return;
      case "up":
      case "k":
        app.focusPreviousRow();
        return;
      case "down":
      case "j":
        app.focusNextRow();
        return;
      case "space":
        app.toggleDiffViewMode();
        return;
      case "r":
        refresh();
        return;
      case "v":
        showCompareBranchDialog();
        return;
      case "s":
        app.stageSelectedFile();
        return;
      case "u":
        app.unstageSelectedFile();
        return;
      case "x":
        app.discardSelectedFile();
        return;
      case "[":
        app.shrinkSidebar();
        return;
      case "]":
        app.growSidebar();
        return;
      case "\\":
        app.toggleSidebar();
        return;
      case "escape":
        if (app.viewMode === "compare") {
          app.exitCompareMode();
        } else {
          renderer.destroy();
        }
        return;
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
        selectionSource={app.selectionSource}
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
        selectedFileInfo={app.selectedFileInfo}
        diffContent={app.diffContent}
        diffViewMode={app.diffViewMode}
        toggleDiffViewMode={app.toggleDiffViewMode}
      />

      <Toast theme={theme} />
    </box>
  );
}

export function AppRoot() {
  const renderer = useRenderer();
  const [mode, setMode] = useState<ThemeMode | null>(renderer.themeMode);
  const client = process.env.USE_FAKE_GIT === "1" ? createFakeGitClient() : undefined;

  useEffect(() => {
    const handleThemeMode = (nextMode: ThemeMode) => {
      setMode(nextMode);
    };

    setMode(renderer.themeMode);
    renderer.on("theme_mode", handleThemeMode);

    return () => {
      renderer.off("theme_mode", handleThemeMode);
    };
  }, [renderer]);

  return (
    <ThemeProvider mode={mode ?? undefined}>
      <ReviewProvider client={client}>
        <ReviewStateProvider>
          <DialogProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </DialogProvider>
        </ReviewStateProvider>
      </ReviewProvider>
    </ThemeProvider>
  );
}
