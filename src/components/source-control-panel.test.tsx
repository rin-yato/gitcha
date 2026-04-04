import { testRender } from "@opentui/react/test-utils";

import type { GitRepoStatus } from "../git";
import type { Theme } from "../styles/theme";
import { SourceControlPanel } from "./source-control-panel";
import { expect, test } from "bun:test";

const theme: Theme = {
  background: "#000000",
  surface: "#111111",
  border: "#222222",
  text: "#ffffff",
  textMuted: "#999999",
  accent: "#00aaff",
  added: "#00ff00",
  removed: "#ff0000",
  modified: "#ffaa00",
  success: "#00ff00",
  warning: "#ffaa00",
  error: "#ff0000",
};

const cleanStatus: GitRepoStatus = {
  branch: "main",
  aheadCount: 0,
  behindCount: 0,
  files: {
    staged: [],
    changes: [],
    untracked: [],
    conflicted: [],
  },
  totalFiles: 0,
  isRepo: true,
};

test("source control panel shows clean state", async () => {
  const setup = await testRender(
    <SourceControlPanel
      theme={theme}
      status={cleanStatus}
      error={null}
      selectedFile={null}
      focusedPath={null}
      selectFile={() => {}}
      stageSelectedFile={() => {}}
      unstageSelectedFile={() => {}}
      discardSelectedFile={() => {}}
      refreshStatus={() => {}}
    />,
    { width: 80, height: 24 },
  );

  await setup.renderOnce();

  const spans = setup.captureSpans();
  expect(JSON.stringify(spans.lines)).toContain("Working tree clean");
});

test("source control panel lists staged and changed files", async () => {
  const setup = await testRender(
    <SourceControlPanel
      theme={theme}
      status={{
        branch: "main",
        aheadCount: 0,
        behindCount: 0,
        files: {
          staged: [{ path: "src/staged.ts", indexStatus: "A", workingTreeStatus: " " }],
          changes: [{ path: "src/changed.ts", indexStatus: " ", workingTreeStatus: "M" }],
          untracked: [],
          conflicted: [],
        },
        totalFiles: 2,
        isRepo: true,
      }}
      error={null}
      selectedFile={null}
      focusedPath={null}
      selectFile={() => {}}
      stageSelectedFile={() => {}}
      unstageSelectedFile={() => {}}
      discardSelectedFile={() => {}}
      refreshStatus={() => {}}
    />,
    { width: 80, height: 24 },
  );

  await setup.renderOnce();

  expect(JSON.stringify(setup.captureSpans().lines)).toContain("Staged");
  expect(JSON.stringify(setup.captureSpans().lines)).toContain("Changes");
});
