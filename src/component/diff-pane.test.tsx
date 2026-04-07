import "../test-setup";

import { testRender } from "@opentui/react/test-utils";

import { act } from "react";

import { createFakeGitClient } from "../context/changes/fake-client";
import { ReviewProvider } from "../context/changes/session";
import { ReviewStateProvider } from "../context/changes/state";
import type { Theme } from "../context/theme/provider";
import { DiffPane } from "./diff-pane";
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

let testSetup: Awaited<ReturnType<typeof testRender>> | null = null;

afterEach(() => {
  if (testSetup) {
    act(() => {
      testSetup?.renderer.destroy();
    });
    testSetup = null;
  }
});

test("code panel shows an empty state", async () => {
  testSetup = await testRender(
    <DiffPane
      theme={theme}
      selectedFile={null}
      selectedFileKey={null}
      diffContent={null}
      diffViewMode="unified"
      toggleDiffViewMode={() => {}}
    />,
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  expect(JSON.stringify(testSetup.captureSpans().lines)).toContain("no file selected");
});

test("code panel shows loading state when a file is selected", async () => {
  testSetup = await testRender(
    <DiffPane
      theme={theme}
      selectedFile="src/app.ts"
      selectedFileKey="changes:src/app.ts"
      diffContent={null}
      diffViewMode="split"
      toggleDiffViewMode={() => {}}
    />,
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  expect(JSON.stringify(testSetup.captureSpans().lines)).toContain("Loading...");
});

test("code panel renders diff content when provided", async () => {
  const backend = createFakeGitClient();
  testSetup = await testRender(
    <ReviewProvider client={backend}>
      <ReviewStateProvider>
        <DiffPane
          theme={theme}
          selectedFile="src/app.ts"
          selectedFileKey="compare:src/app.ts"
          diffContent={`diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,1 +1,1 @@
-console.log("hello from feat/a")
+console.log("hello from feat/b")`}
          diffViewMode="unified"
          toggleDiffViewMode={() => {}}
        />
      </ReviewStateProvider>
    </ReviewProvider>,
    { width: 120, height: 40 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("console.log");
  expect(output).toContain("feat/b");
});
