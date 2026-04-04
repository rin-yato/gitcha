import { createCliRenderer } from "@opentui/core";
import { createRoot, useKeyboard, useRenderer } from "@opentui/react";

import { CommandPrompt } from "./component/command-prompt";
import { DiffPane } from "./component/diff-pane";
import { Sidebar } from "./component/sidebar";
import { createFakeGitClient } from "./context/changes/fake-client";
import { ReviewProvider, useReviewSession } from "./context/changes/session";
import { ReviewStateProvider, useReviewState } from "./context/changes/state";
import {
  type CommandOption,
  CommandPromptProvider,
  useCommandPrompt,
} from "./context/command/prompt";
import { ThemeProvider, useTheme } from "./context/theme/provider";
import { Overlay } from "./ui/overlay";

function App() {
  const renderer = useRenderer();
  const theme = useTheme();
  const git = useReviewSession();
  const app = useReviewState();
  const prompt = useCommandPrompt();

  const commands: CommandOption[] = [
    {
      id: "toggle-compare",
      label: "Toggle Compare Mode",
      description: "Switch between staging and compare views",
      run: () => app.toggleViewMode(),
    },
    {
      id: "refresh",
      label: "Refresh",
      description: "Reload git status or compare diff",
      run: () => {
        if (app.viewMode === "compare") git.refreshCompare();
        else git.refreshStatus();
      },
    },
    {
      id: "toggle-diff-view",
      label: "Toggle Diff View",
      description: "Switch between unified and split diff",
      run: () => app.toggleDiffViewMode(),
    },
    {
      id: "exit-compare",
      label: "Exit Compare Mode",
      description: "Return to staging view",
      run: () => app.exitCompareMode(),
    },
  ];

  useKeyboard((event) => {
    if (prompt.isOpen) {
      const filteredCommands = commands.filter((option) => {
        const query = prompt.query.trim().toLowerCase();
        if (!query) return true;
        return (
          option.label.toLowerCase().includes(query) ||
          option.description?.toLowerCase().includes(query)
        );
      });

      if (event.name === "escape") {
        prompt.close();
        return;
      }
      if (event.name === "up" || event.name === "k") {
        prompt.setSelectedIndex(Math.max(0, prompt.selectedIndex - 1));
        return;
      }
      if (event.name === "down" || event.name === "j") {
        prompt.setSelectedIndex(
          Math.min(filteredCommands.length - 1, prompt.selectedIndex + 1),
        );
        return;
      }
      if (
        (event.name === "enter" || event.name === "return") &&
        filteredCommands[prompt.selectedIndex]
      ) {
        filteredCommands[prompt.selectedIndex]?.run();
        prompt.close();
        return;
      }
      return;
    }

    if (event.name === "/") {
      prompt.open();
      return;
    }
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
    if (event.name === "[") app.shrinkSidebar();
    if (event.name === "]") app.growSidebar();
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

      {prompt.isOpen ? (
        <Overlay backgroundColor={`${theme.background}cc`}>
          <CommandPrompt
            theme={theme}
            options={commands}
            onSubmit={(option) => {
              option.run();
              prompt.close();
            }}
          />
        </Overlay>
      ) : null}
    </box>
  );
}

const renderer = await createCliRenderer();

const client = process.env.USE_REAL_GIT === "1" ? undefined : createFakeGitClient();

createRoot(renderer as never).render(
  <ThemeProvider>
    <ReviewProvider client={client}>
      <ReviewStateProvider>
        <CommandPromptProvider>
          <App />
        </CommandPromptProvider>
      </ReviewStateProvider>
    </ReviewProvider>
  </ThemeProvider>,
);
