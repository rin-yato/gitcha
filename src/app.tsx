import { useKeyboard, useRenderer } from "@opentui/react";

import { useCallback, useEffect, useState } from "react";

import { ReviewDiffProvider, useReviewDiff } from "@/context/diff";
import { ReviewLayoutProvider, useReviewLayout } from "@/context/layout";
import { ReviewSelectionProvider, useReviewSelection } from "@/context/selection";
import {
  type GitClient,
  type ReviewBootstrap,
  ReviewProvider,
  useReviewSession,
} from "@/context/session/session";
import { type Theme, type ThemeMode, ThemeProvider, useTheme } from "@/context/theme/provider";
import { ReviewViewProvider, useReviewView } from "@/context/view";

import type { CompareTarget } from "@/lib/git";

import {
  buildCommandMap,
  buildCommandOptions,
  buildCommandSelectOptions,
} from "@/component/app-commands";
import { DialogCommand } from "@/component/dialog-command";
import { CompareDialog } from "@/component/dialog-compare";
import { ThemeDialog } from "@/component/dialog-theme";
import { DiffPane } from "@/component/diff-pane";
import { Sidebar } from "@/component/sidebar/index";
import { DialogProvider, useDialog } from "@/component/ui/dialog";
import { Overlay } from "@/component/ui/overlay";
import { Toast, ToastProvider } from "@/component/ui/toast";

type CompareData = {
  branches: { ref: string; label: string; description?: string }[];
  commits: { ref: string; label: string; description: string }[];
  defaultCompareTarget: CompareTarget | null;
};

type AppRootProps = {
  bootstrap: Promise<ReviewBootstrap>;
};

function CompareBranchDialogLoader(props: {
  client: GitClient;
  currentBranch: string | null;
  activeCompareTarget: CompareTarget | null;
  theme: Theme;
  onSelect: (target: CompareTarget) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<CompareData | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void Promise.all([
      props.client.getCompareBranches().catch(() => []),
      props.client.getRecentCommitSummaries(12).catch(() => []),
      props.client.getCompareTarget().catch(() => null),
    ]).then(([branches, commits, defaultCompareTarget]) => {
      if (controller.signal.aborted) return;
      setData({
        branches: branches.map((branch) => ({ ref: branch, label: branch })),
        commits: commits.map((commit) => ({
          ref: commit.ref,
          label: `${commit.shortRef} ${commit.subject}`,
          description: commit.subject,
        })),
        defaultCompareTarget,
      });
    });

    return () => controller.abort();
  }, [props.client]);

  const defaultCompareTarget = props.activeCompareTarget ?? data?.defaultCompareTarget ?? null;

  useKeyboard((event) => {
    if (!data && event.name === "escape") {
      props.onClose();
    }
  });

  if (!data) {
    return (
      <Overlay>
        <box paddingX={2} paddingY={1} backgroundColor={props.theme.surface}>
          <text content="Loading branches..." fg={props.theme.textMuted} selectable={false} />
        </box>
      </Overlay>
    );
  }

  return (
    <CompareDialog
      theme={props.theme}
      branches={data.branches}
      commits={data.commits}
      currentBranch={props.currentBranch}
      activeCompareTarget={props.activeCompareTarget}
      defaultCompareTarget={defaultCompareTarget}
      onSelect={props.onSelect}
      onClose={props.onClose}
    />
  );
}

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
      <CompareBranchDialogLoader
        client={git.client}
        currentBranch={git.status?.branch ?? null}
        activeCompareTarget={
          git.compareState
            ? {
                mode: git.compareState.mode,
                ref: git.compareState.targetRef ?? git.compareState.baseRef,
                label: git.compareState.baseLabel,
              }
            : null
        }
        theme={theme}
        onSelect={(target) => {
          dialog.clear();
          void view.enterCompareMode(target);
        }}
        onClose={() => dialog.clear()}
      />,
    );
  }, [dialog, git.client, git.compareState, git.status?.branch, theme, view]);

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
        fileTrees={git.fileTrees}
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

export function AppRootWithBootstrap({ bootstrap }: AppRootProps) {
  const renderer = useRenderer();
  const [mode, setMode] = useState<ThemeMode | null>(renderer.themeMode);

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
      <ReviewProvider bootstrap={bootstrap}>
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
