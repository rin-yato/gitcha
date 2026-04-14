import { useKeyboard, useRenderer } from "@opentui/react";

import { useCallback, useEffect, useState } from "react";

import { ReviewDiffProvider, useReviewDiff } from "@/context/diff";
import { ReviewLayoutProvider, useReviewLayout } from "@/context/layout";
import { ReviewSelectionProvider, useReviewSelection } from "@/context/selection";
import { createFakeGitClient } from "@/context/session/fake-client";
import { ReviewProvider, useReviewSession } from "@/context/session/session";
import { type ThemeMode, ThemeProvider, useTheme } from "@/context/theme/provider";
import { ReviewViewProvider, useReviewView } from "@/context/view";

import {
  buildCommandMap,
  buildCommandOptions,
  buildCommandSelectOptions,
} from "@/component/app-commands";
import { DialogCommand } from "@/component/dialog-command";
import { CompareBranchDialog } from "@/component/dialog-compare-branch";
import { ThemeDialog } from "@/component/dialog-theme";
import { DiffPane } from "@/component/diff-pane";
import { Sidebar } from "@/component/sidebar/index";
import { DialogProvider, useDialog } from "@/component/ui/dialog";
import { Toast, ToastProvider } from "@/component/ui/toast";

function App() {
  const renderer = useRenderer();
  const theme = useTheme();
  const git = useReviewSession();
  const selection = useReviewSelection();
  const diff = useReviewDiff();
  const view = useReviewView();
  const layout = useReviewLayout();
  const dialog = useDialog();

  const refresh = useCallback(() => {
    if (view.viewMode === "compare") {
      git.refreshCompare();
      return;
    }

    git.refreshStatus();
  }, [git, view.viewMode]);

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
          view.enterCompareMode(target);
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
    view,
  ]);

  const showCommandPalette = useCallback(() => {
    const commands = buildCommandOptions({
      refresh,
      showCompareBranchDialog,
      showThemeDialog,
      app: {
        toggleDiffViewMode: diff.toggleDiffViewMode,
        exitCompareMode: view.exitCompareMode,
        stageSelectedFile: selection.stageSelectedFile,
        unstageSelectedFile: selection.unstageSelectedFile,
        discardSelectedFile: selection.discardSelectedFile,
        shrinkSidebar: layout.shrinkSidebar,
        growSidebar: layout.growSidebar,
        toggleSidebar: layout.toggleSidebar,
      },
    });

    dialog.replace(
      <DialogCommand
        theme={theme}
        options={buildCommandSelectOptions(commands)}
        commands={buildCommandMap(commands)}
      />,
    );
  }, [
    dialog,
    diff,
    layout,
    refresh,
    selection,
    showCompareBranchDialog,
    showThemeDialog,
    theme,
    view,
  ]);

  useKeyboard((event) => {
    if (dialog.stack.length > 0) return;

    switch (event.name) {
      case "/":
        showCommandPalette();
        return;
      case "up":
      case "k":
        selection.focusPreviousRow();
        return;
      case "down":
      case "j":
        selection.focusNextRow();
        return;
      case "space":
        diff.toggleDiffViewMode();
        return;
      case "r":
        refresh();
        return;
      case "v":
        showCompareBranchDialog();
        return;
      case "s":
        selection.stageSelectedFile();
        return;
      case "u":
        selection.unstageSelectedFile();
        return;
      case "x":
        selection.discardSelectedFile();
        return;
      case "[":
        layout.shrinkSidebar();
        return;
      case "]":
        layout.growSidebar();
        return;
      case "\\":
        layout.toggleSidebar();
        return;
      case "escape":
        if (view.viewMode === "compare") {
          view.exitCompareMode();
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
        selectedFileKey={selection.selectedFileKey}
        focusedFileKey={selection.focusedFileKey}
        selectionSource={selection.selectionSource}
        selectFile={selection.selectFile}
        viewMode={view.viewMode}
        compareState={git.compareState}
        isOpen={layout.isSidebarOpen}
        width={layout.sidebarWidth}
      />

      <DiffPane
        theme={theme}
        selectedFile={selection.selectedFile}
        selectedFileKey={selection.selectedFileKey}
        selectedFileInfo={selection.selectedFileInfo}
        diffContent={diff.diffContent}
        diffViewMode={diff.diffViewMode}
        toggleDiffViewMode={diff.toggleDiffViewMode}
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
        <ReviewSelectionProvider>
          <ReviewDiffProvider>
            <ReviewViewProvider>
              <ReviewLayoutProvider>
                <DialogProvider>
                  <ToastProvider>
                    <App />
                  </ToastProvider>
                </DialogProvider>
              </ReviewLayoutProvider>
            </ReviewViewProvider>
          </ReviewDiffProvider>
        </ReviewSelectionProvider>
      </ReviewProvider>
    </ThemeProvider>
  );
}
