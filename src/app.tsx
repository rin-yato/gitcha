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

import { type AppConfig, matchesAnyShortcut, openAppConfig } from "@/lib/config";
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
import { Toast, ToastProvider, useToast } from "@/component/ui/toast";

type CompareData = {
  branches: { ref: string; label: string; description?: string }[];
  commits: { ref: string; message: string; origin: string }[];
  defaultCompareTarget: CompareTarget | null;
};

type AppRootProps = {
  bootstrap: Promise<ReviewBootstrap>;
  initialConfig: AppConfig;
};

type AppProps = {
  config: AppConfig;
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

function App({ config }: AppProps) {
  const renderer = useRenderer();
  const theme = useTheme();
  const toast = useToast();
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

  const handleOpenConfigFile = useCallback(() => {
    void openAppConfig().then((opened) => {
      if (!opened) {
        toast.error("Set $EDITOR or $VISUAL to open gitcha.json.");
      }
    });
  }, [toast]);

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
      keybindings: config.keybindings,
      app: {
        toggleDiffViewMode: diff.toggleDiffViewMode,
        exitCompareMode: view.exitCompareMode,
        stageSelectedFile: selection.stageSelectedFile,
        unstageSelectedFile: selection.unstageSelectedFile,
        discardSelectedFile: selection.discardSelectedFile,
        shrinkSidebar: layout.shrinkSidebar,
        growSidebar: layout.growSidebar,
        toggleSidebar: layout.toggleSidebar,
        openConfigFile: handleOpenConfigFile,
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
    handleOpenConfigFile,
    handleUpgrade,
    config.keybindings,
    theme,
    view,
  ]);

  useKeyboard((event) => {
    if (dialog.stack.length > 0) return;

    if (matchesAnyShortcut(event, config.keybindings.openCommandPalette)) {
      showCommandPalette();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.moveUp)) {
      selection.focusPreviousRow();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.moveDown)) {
      selection.focusNextRow();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.toggleDiffView)) {
      diff.toggleDiffViewMode();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.refresh)) {
      refresh();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.openCompareDialog)) {
      showCompareBranchDialog();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.openThemeDialog)) {
      showThemeDialog();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.openStatusDialog)) {
      showStatusDialog();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.upgradeApp)) {
      handleUpgrade();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.stageSelectedFile)) {
      selection.stageSelectedFile();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.unstageSelectedFile)) {
      selection.unstageSelectedFile();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.discardSelectedFile)) {
      selection.discardSelectedFile();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.shrinkSidebar)) {
      layout.shrinkSidebar();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.growSidebar)) {
      layout.growSidebar();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.toggleSidebar)) {
      layout.toggleSidebar();
      return;
    }

    if (matchesAnyShortcut(event, config.keybindings.quit)) {
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

export function AppRootWithBootstrap({ bootstrap, initialConfig }: AppRootProps) {
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
    <ThemeProvider mode={mode ?? undefined} initialThemeId={initialConfig.themeId}>
      <ReviewProvider bootstrap={bootstrap}>
        <ReviewSelectionProvider>
          <ReviewDiffProvider>
            <ReviewViewProvider>
              <ReviewLayoutProvider initialSidebarWidth={initialConfig.sidebarWidth}>
                <DialogProvider>
                  <ToastProvider>
                    <App config={initialConfig} />
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
