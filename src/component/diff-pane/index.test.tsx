import "../../test-setup";

import { afterEach, expect, test } from "bun:test";

import { testRender } from "@opentui/react/test-utils";

import { act } from "react";

import type { Theme } from "@/context/theme/provider";

import "../slottable-diff";

import { DiffPane } from "./index";

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
      selectedFileInfo={null}
      diffContent={null}
      diffViewMode="unified"
      toggleDiffViewMode={() => {}}
    />,
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
    await new Promise((resolve) => setTimeout(resolve, 50));
    await testSetup?.renderOnce();
    await new Promise((resolve) => setTimeout(resolve, 50));
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
      selectedFileInfo={null}
      diffContent={null}
      diffViewMode="split"
      toggleDiffViewMode={() => {}}
    />,
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await testSetup?.renderOnce();
  });

  expect(JSON.stringify(testSetup.captureSpans().lines)).toContain("Loading...");
});

test("code panel renders diff content when provided", async () => {
  testSetup = await testRender(
    <DiffPane
      theme={theme}
      selectedFile="src/app.ts"
      selectedFileKey="compare:src/app.ts"
      selectedFileInfo={null}
      diffContent={`diff --git a/src/app.ts b/src/app.ts
 index 1111111..2222222 100644
 --- a/src/app.ts
 +++ b/src/app.ts
 @@ -1,1 +1,1 @@
 -console.log("hello from feat/a")
 +console.log("hello from feat/b")`}
      diffViewMode="unified"
      toggleDiffViewMode={() => {}}
    />,
    { width: 120, height: 40 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("src/app.ts");
  expect(output).toContain("unified");
});

test("code panel hides scrollbar when diff fits", async () => {
  testSetup = await testRender(
    <DiffPane
      theme={theme}
      selectedFile="src/app.ts"
      selectedFileKey="compare:src/app.ts"
      selectedFileInfo={null}
      diffContent={`diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1 +1 @@
-a
+b`}
      diffViewMode="unified"
      toggleDiffViewMode={() => {}}
    />,
    { width: 120, height: 20 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).not.toContain("▎");
});

test("code panel shows scrollbar when diff overflows", async () => {
  const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);

  testSetup = await testRender(
    <DiffPane
      theme={theme}
      selectedFile="src/app.ts"
      selectedFileKey="compare:src/app.ts"
      selectedFileInfo={null}
      diffContent={`diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,30 +1,30 @@
${lines.map((line) => `-${line}`).join("\n")}
${lines.map((line) => `+${line} updated`).join("\n")}`}
      diffViewMode="unified"
      toggleDiffViewMode={() => {}}
    />,
    { width: 120, height: 12 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("▎");
});

test("code panel shows rename source when file was renamed", async () => {
  testSetup = await testRender(
    <DiffPane
      theme={theme}
      selectedFile="src/ui/panel.renamed.tsx"
      selectedFileKey="staged:src/ui/panel.renamed.tsx"
      selectedFileInfo={{
        path: "src/ui/panel.renamed.tsx",
        originalPath: "src/ui/panel.tsx",
        indexStatus: "R",
        workingTreeStatus: " ",
      }}
      diffContent={`diff --git a/src/ui/panel.tsx b/src/ui/panel.renamed.tsx
similarity index 95%
rename from src/ui/panel.tsx
rename to src/ui/panel.renamed.tsx
@@ -1,1 +1,1 @@
-old
+new`}
      diffViewMode="unified"
      toggleDiffViewMode={() => {}}
    />,
    { width: 120, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("Renamed");
  expect(output).toContain("src/ui/panel.tsx");
});
