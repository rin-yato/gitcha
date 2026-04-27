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
import { upgradeApp } from "@/lib/upgrade";

import {
  buildCommandMap,
  buildCommandOptions,
  buildCommandSelectOptions,
} from "@/component/app-commands";
import { DialogCommand } from "@/component/dialog-command";
import { CompareDialog } from "@/component/dialog-compare";
import { StatusDialog } from "@/component/dialog-status";
import { ThemeDialog } from "@/component/dialog-theme";
import { DiffPane } from "@/component/diff-pane";
import { Sidebar } from "@/component/sidebar/index";
import { DialogProvider, useDialog } from "@/component/ui/dialog";
import { Toast, ToastProvider } from "@/component/ui/toast";

type CompareData = {
  branches: { ref: string; label: string; description?: string }[];
  commits: { ref: string; message: string; origin: string }[];
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
  const [results, setResults] = useState<CompareData | null>(null);

  const loadSearchResults = useCallback(
    async (nextQuery: string) => {
      const normalizedQuery = nextQuery.trim();
      const [branches, commits] = await Promise.all([
        props.client.searchCompareBranches(normalizedQuery).catch(() => []),
        props.client.searchCompareCommits(normalizedQuery).catch(() => []),
      ]);

      setResults({
        branches: branches.map((branch) => ({ ref: branch, label: branch })),
        commits: commits.map((commit) => ({
          ref: commit.ref,
          message: `${commit.shortRef} ${commit.message}`,
          origin: commit.origin,
        })),
        defaultCompareTarget: data?.defaultCompareTarget ?? null,
      });
    },
    [data?.defaultCompareTarget, props.client],
  );

  useEffect(() => {
    const controller = new AbortController();

    void Promise.all([
      props.client.getCompareBranches().catch(() => []),
      props.client.getRecentCommitSummaries(30).catch(() => []),
      props.client.getCompareTarget().catch(() => null),
    ]).then(([branches, commits, defaultCompareTarget]) => {
      if (controller.signal.aborted) return;
      setData({
        branches: branches.map((branch) => ({ ref: branch, label: branch })),
        commits: commits.map((commit) => ({
          ref: commit.ref,
          message: `${commit.shortRef} ${commit.message}`,
          origin: commit.origin,
        })),
        defaultCompareTarget,
      });
    });

    return () => controller.abort();
  }, [props.client]);

  const defaultCompareTarget = props.activeCompareTarget ?? data?.defaultCompareTarget ?? null;
  const visibleData = results ?? data;

  return (
    <CompareDialog
      theme={props.theme}
      branches={visibleData?.branches ?? []}
      commits={visibleData?.commits ?? []}
      currentBranch={props.currentBranch}
      activeCompareTarget={props.activeCompareTarget}
      defaultCompareTarget={defaultCompareTarget}
      onSelect={props.onSelect}
      onClose={props.onClose}
      onQueryChange={(query) => {
        void loadSearchResults(query);
      }}
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

  const showStatusDialog = useCallback(() => {
    dialog.replace(
      <StatusDialog
        theme={theme}
        gitRoot={git.client.ctx.root}
        watcherMode={git.watcherMode}
        onClose={() => dialog.clear()}
      />,
    );
  }, [dialog, git.client.ctx.root, git.watcherMode, theme]);

  const handleUpgrade = useCallback(() => {
    void upgradeApp();
  }, []);

  const showCompareBranchDialog = useCallback(() => {
    dialog.show(
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
      showStatusDialog,
      app: {
        toggleDiffViewMode: diff.toggleDiffViewMode,
        exitCompareMode: view.exitCompareMode,
        stageSelectedFile: selection.stageSelectedFile,
        unstageSelectedFile: selection.unstageSelectedFile,
        discardSelectedFile: selection.discardSelectedFile,
        shrinkSidebar: layout.shrinkSidebar,
        growSidebar: layout.growSidebar,
        toggleSidebar: layout.toggleSidebar,
        upgradeApp: handleUpgrade,
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
    showStatusDialog,
    handleUpgrade,
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
      paddingY={1}
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
        unsupportedReason={diff.unsupportedReason}
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
