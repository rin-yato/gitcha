import { testRender } from "@opentui/react/test-utils";

import { act } from "react";

import type { Theme } from "../context/theme/provider";
import type { GitRepoStatus } from "../git";
import { Sidebar } from "./sidebar";
import { afterEach, expect, test } from "bun:test";

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

const defaultCompareProps = {
  viewMode: "staging" as const,
  branchPickerOpen: false,
  branches: [] as string[],
  currentBranch: null as string | null,
  compareState: null,
  selectCompareBranch: () => {},
  toggleViewMode: () => {},
};

let testSetup: Awaited<ReturnType<typeof testRender>> | null = null;

afterEach(() => {
  if (testSetup) {
    act(() => {
      testSetup?.renderer.destroy();
    });
    testSetup = null;
  }
});

test("source control panel shows clean state", async () => {
  testSetup = await testRender(
    <Sidebar
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
      {...defaultCompareProps}
      width={40}
    />,
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const spans = testSetup.captureSpans();
  expect(JSON.stringify(spans.lines)).toContain("Working tree clean");
});

test("source control panel lists staged and changed files", async () => {
  testSetup = await testRender(
    <Sidebar
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
      {...defaultCompareProps}
      width={40}
    />,
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  expect(JSON.stringify(testSetup.captureSpans().lines)).toContain("Staged");
  expect(JSON.stringify(testSetup.captureSpans().lines)).toContain("Changes");
});

test("source control panel shows compare mode header", async () => {
  testSetup = await testRender(
    <Sidebar
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
      viewMode="compare"
      branchPickerOpen={false}
      branches={["main", "feature"]}
      currentBranch="feature"
      compareState={{
        baseRef: "main",
        baseLabel: "main",
        files: [{ path: "src/app.ts", indexStatus: " ", workingTreeStatus: "M" }],
      }}
      selectCompareBranch={() => {}}
      toggleViewMode={() => {}}
      width={40}
    />,
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  expect(JSON.stringify(testSetup.captureSpans().lines)).toContain("Compare");
  expect(JSON.stringify(testSetup.captureSpans().lines)).toContain("Changes");
});

test("branch picker shows when branchPickerOpen is true", async () => {
  testSetup = await testRender(
    <Sidebar
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
      viewMode="compare"
      branchPickerOpen={true}
      branches={["main", "develop", "feature"]}
      currentBranch="feature"
      compareState={null}
      selectCompareBranch={() => {}}
      toggleViewMode={() => {}}
      width={40}
    />,
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("Compare to:");
  expect(output).toContain("main");
  expect(output).toContain("develop");
  expect(output).toContain("feature");
});

test("branch picker shows current branch indicator", async () => {
  testSetup = await testRender(
    <Sidebar
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
      viewMode="compare"
      branchPickerOpen={true}
      branches={["main", "feature"]}
      currentBranch="feature"
      compareState={null}
      selectCompareBranch={() => {}}
      toggleViewMode={() => {}}
      width={40}
    />,
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("(current)");
});

test("branch picker shows empty state when no branches", async () => {
  testSetup = await testRender(
    <Sidebar
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
      viewMode="compare"
      branchPickerOpen={true}
      branches={[]}
      currentBranch={null}
      compareState={null}
      selectCompareBranch={() => {}}
      toggleViewMode={() => {}}
      width={40}
    />,
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("No branches found");
});

test("compare mode shows 'no changes' message when file list is empty", async () => {
  testSetup = await testRender(
    <Sidebar
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
      viewMode="compare"
      branchPickerOpen={false}
      branches={["main"]}
      currentBranch="main"
      compareState={{
        baseRef: "main",
        baseLabel: "main",
        files: [],
      }}
      selectCompareBranch={() => {}}
      toggleViewMode={() => {}}
      width={40}
    />,
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("No changes vs");
});
