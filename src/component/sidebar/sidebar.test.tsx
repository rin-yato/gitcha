import { afterEach, expect, test } from "bun:test";

import { testRender } from "@opentui/react/test-utils";

import { act } from "react";

import type { Theme } from "@/context/theme/provider";

import type { GitRepoStatus } from "@/lib/git";

import { Sidebar } from "./index";

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
  files: { staged: [], changes: [], untracked: [], conflicted: [] },
  totalFiles: 0,
  isRepo: true,
};

const baseProps = {
  viewMode: "staging" as const,
  compareState: null,
  isOpen: true,
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

function renderSidebar(props: Partial<Parameters<typeof Sidebar>[0]> = {}) {
  return (
    <Sidebar
      theme={theme}
      width={40}
      status={cleanStatus}
      error={null}
      selectedFileKey={null}
      focusedFileKey={null}
      selectionSource="programmatic"
      selectFile={() => {}}
      {...baseProps}
      {...props}
    />
  );
}

test("sidebar shows clean state", async () => {
  testSetup = await testRender(renderSidebar({ status: cleanStatus, error: null }), {
    width: 80,
    height: 24,
  });

  await act(async () => {
    await testSetup?.renderOnce();
  });

  expect(JSON.stringify(testSetup.captureSpans().lines)).toContain("Working tree clean");
});

test("sidebar lists staged and changed files", async () => {
  testSetup = await testRender(
    renderSidebar({
      status: {
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
      },
      error: null,
    }),
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("Staged");
  expect(output).toContain("Changes");
});

test("sidebar shows compare mode header", async () => {
  testSetup = await testRender(
    renderSidebar({
      status: cleanStatus,
      error: null,
      viewMode: "compare",
      compareState: {
        baseRef: "main",
        baseLabel: "main",
        files: [{ path: "src/app.ts", indexStatus: " ", workingTreeStatus: "M" }],
      },
    }),
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("Compare");
  expect(output).toContain("Changes");
});

test("sidebar shows error message", async () => {
  testSetup = await testRender(
    renderSidebar({ status: cleanStatus, error: "Failed to load git status" }),
    {
      width: 80,
      height: 24,
    },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  expect(JSON.stringify(testSetup.captureSpans().lines)).toContain("Failed");
});

test("sidebar highlights focused file", async () => {
  testSetup = await testRender(
    renderSidebar({
      status: {
        branch: "main",
        aheadCount: 0,
        behindCount: 0,
        files: {
          staged: [],
          changes: [{ path: "src/app.ts", indexStatus: " ", workingTreeStatus: "M" }],
          untracked: [],
          conflicted: [],
        },
        totalFiles: 1,
        isRepo: true,
      },
      error: null,
      focusedFileKey: "changes:src/app.ts",
    }),
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  expect(JSON.stringify(testSetup.captureSpans().lines)).toContain("app.ts");
});

test("sidebar highlights selected file", async () => {
  testSetup = await testRender(
    renderSidebar({
      status: {
        branch: "main",
        aheadCount: 0,
        behindCount: 0,
        files: {
          staged: [],
          changes: [{ path: "src/app.ts", indexStatus: " ", workingTreeStatus: "M" }],
          untracked: [],
          conflicted: [],
        },
        totalFiles: 1,
        isRepo: true,
      },
      error: null,
      selectedFileKey: "changes:src/app.ts",
      focusedFileKey: "changes:src/app.ts",
      selectionSource: "keyboard",
    }),
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  expect(JSON.stringify(testSetup.captureSpans().lines)).toContain("app.ts");
});

test("sidebar shows untracked files in changes section", async () => {
  testSetup = await testRender(
    renderSidebar({
      status: {
        branch: "main",
        aheadCount: 0,
        behindCount: 0,
        files: {
          staged: [],
          changes: [],
          untracked: [{ path: "new-file.txt", indexStatus: "?", workingTreeStatus: "?" }],
          conflicted: [],
        },
        totalFiles: 1,
        isRepo: true,
      },
      error: null,
    }),
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("Changes");
  expect(output).toContain("new-file.txt");
});

test("sidebar renders same path in different sections independently", async () => {
  testSetup = await testRender(
    renderSidebar({
      status: {
        branch: "main",
        aheadCount: 0,
        behindCount: 0,
        files: {
          staged: [{ path: "src/shared.ts", indexStatus: "A", workingTreeStatus: " " }],
          changes: [{ path: "src/shared.ts", indexStatus: " ", workingTreeStatus: "M" }],
          untracked: [],
          conflicted: [],
        },
        totalFiles: 2,
        isRepo: true,
      },
      error: null,
      selectedFileKey: "staged:src/shared.ts",
      focusedFileKey: "changes:src/shared.ts",
    }),
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("Staged");
  expect(output).toContain("Changes");
  expect(output).toContain("shared.ts");
});

test("sidebar scrolls the selected file into view", async () => {
  // Use zero-padded names so alphabetical sort matches insertion order
  const staged = Array.from({ length: 14 }, (_, i) => ({
    path: `src/staged-${i.toString().padStart(2, "0")}.ts`,
    indexStatus: "A" as const,
    workingTreeStatus: " " as const,
  }));

  testSetup = await testRender(
    renderSidebar({
      status: {
        branch: "main",
        aheadCount: 0,
        behindCount: 0,
        files: {
          staged,
          changes: [],
          untracked: [],
          conflicted: [],
        },
        totalFiles: staged.length,
        isRepo: true,
      },
      error: null,
      selectedFileKey: "staged:src/staged-13.ts",
      focusedFileKey: "staged:src/staged-13.ts",
      selectionSource: "keyboard",
    }),
    { width: 80, height: 10 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("staged-13.ts");
  expect(output).not.toContain("staged-00.ts");
});

test("sidebar does not auto scroll on mouse selection", async () => {
  // Use zero-padded names so alphabetical sort matches insertion order
  const staged = Array.from({ length: 14 }, (_, i) => ({
    path: `src/staged-${i.toString().padStart(2, "0")}.ts`,
    indexStatus: "A" as const,
    workingTreeStatus: " " as const,
  }));

  testSetup = await testRender(
    renderSidebar({
      status: {
        branch: "main",
        aheadCount: 0,
        behindCount: 0,
        files: {
          staged,
          changes: [],
          untracked: [],
          conflicted: [],
        },
        totalFiles: staged.length,
        isRepo: true,
      },
      error: null,
      selectedFileKey: "staged:src/staged-13.ts",
      focusedFileKey: "staged:src/staged-13.ts",
      selectionSource: "mouse",
    }),
    { width: 80, height: 10 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("staged-00.ts");
  expect(output).not.toContain("staged-13.ts");
});

test("sidebar shows tree structure for nested files", async () => {
  testSetup = await testRender(
    renderSidebar({
      status: {
        branch: "main",
        aheadCount: 0,
        behindCount: 0,
        files: {
          staged: [],
          changes: [
            {
              path: "src/features/component-name.ts",
              indexStatus: " ",
              workingTreeStatus: "M",
            },
          ],
          untracked: [],
          conflicted: [],
        },
        totalFiles: 1,
        isRepo: true,
      },
      error: null,
    }),
    { width: 40, height: 10 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("src/features");
  expect(output).toContain("component-name.ts");
});

test("sidebar flattens single-child directory chains", async () => {
  testSetup = await testRender(
    renderSidebar({
      status: {
        branch: "main",
        aheadCount: 0,
        behindCount: 0,
        files: {
          staged: [],
          changes: [
            { path: "a/b/c/changes.ts", indexStatus: " ", workingTreeStatus: "M" },
            { path: "a/file-in-a.ts", indexStatus: " ", workingTreeStatus: "M" },
          ],
          untracked: [],
          conflicted: [],
        },
        totalFiles: 2,
        isRepo: true,
      },
      error: null,
    }),
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("a");
  expect(output).toContain("b/c");
  expect(output).toContain("changes.ts");
  expect(output).toContain("file-in-a.ts");
});
