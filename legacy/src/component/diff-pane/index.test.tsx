import "../../test-setup";

import { afterEach, expect, test } from "bun:test";

import { testRender } from "@opentui/react/test-utils";

import { ToastProvider } from "@/component/ui/toast";

import { act } from "react";

import { DiffPane } from ".";
import type { Theme } from "@/context/theme/provider";

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

function withToastProvider(content: React.ReactNode) {
  return <ToastProvider>{content}</ToastProvider>;
}

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
    withToastProvider(
      <DiffPane
        theme={theme}
        selectedFile={null}
        selectedFileKey={null}
        selectedFileInfo={null}
        diffContent={null}
        unsupportedReason={null}
        isLoading={false}
        diffViewMode="unified"
        toggleDiffViewMode={() => {}}
      />,
    ),
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

test("code panel keeps diff empty while loading", async () => {
  testSetup = await testRender(
    withToastProvider(
      <DiffPane
        theme={theme}
        selectedFile="src/app.ts"
        selectedFileKey="changes:src/app.ts"
        selectedFileInfo={null}
        diffContent={null}
        unsupportedReason={null}
        isLoading={true}
        diffViewMode="split"
        toggleDiffViewMode={() => {}}
      />,
    ),
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
    await new Promise((resolve) => setTimeout(resolve, 10));
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).not.toContain("Unsupported file");
});

test("code panel keeps layout stable while loading", async () => {
  testSetup = await testRender(
    withToastProvider(
      <DiffPane
        theme={theme}
        selectedFile="src/app.ts"
        selectedFileKey="compare:src/app.ts"
        selectedFileInfo={null}
        diffContent={null}
        unsupportedReason={null}
        isLoading={true}
        diffViewMode="unified"
        toggleDiffViewMode={() => {}}
      />,
    ),
    { width: 120, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).not.toContain("Unsupported file");
});

test("code panel shows unsupported overlay when file is binary", async () => {
  testSetup = await testRender(
    withToastProvider(
      <DiffPane
        theme={theme}
        selectedFile="assets/logo.png"
        selectedFileKey="changes:assets/logo.png"
        selectedFileInfo={null}
        diffContent={null}
        unsupportedReason="Binary file - cannot display diff"
        isLoading={false}
        diffViewMode="unified"
        toggleDiffViewMode={() => {}}
      />,
    ),
    { width: 80, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("Unsupported file");
  expect(output).toContain("assets/logo.png");
  expect(output).toContain("Binary file - cannot display diff");
});

test("code panel renders diff content when provided", async () => {
  testSetup = await testRender(
    withToastProvider(
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
        unsupportedReason={null}
        isLoading={false}
        diffViewMode="unified"
        toggleDiffViewMode={() => {}}
      />,
    ),
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
    withToastProvider(
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
        isLoading={false}
        diffViewMode="unified"
        toggleDiffViewMode={() => {}}
      />,
    ),
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
    withToastProvider(
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
        isLoading={false}
        diffViewMode="unified"
        toggleDiffViewMode={() => {}}
      />,
    ),
    { width: 120, height: 12 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("▎");
});

test("code panel shows split scrollbar when diff overflows", async () => {
  const lines = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`);

  testSetup = await testRender(
    withToastProvider(
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
        isLoading={false}
        diffViewMode="split"
        toggleDiffViewMode={() => {}}
      />,
    ),
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
    withToastProvider(
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
        isLoading={false}
        diffViewMode="unified"
        toggleDiffViewMode={() => {}}
      />,
    ),
    { width: 120, height: 24 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
  });

  const output = JSON.stringify(testSetup.captureSpans().lines);
  expect(output).toContain("Renamed");
  expect(output).toContain("src/ui/panel.tsx");
});

test("code panel updates unified viewport content when scrolled", async () => {
  const lines = Array.from({ length: 80 }, (_, i) => `line ${i + 1}`);

  testSetup = await testRender(
    withToastProvider(
      <DiffPane
        theme={theme}
        selectedFile="src/app.ts"
        selectedFileKey="compare:src/app.ts"
        selectedFileInfo={null}
        diffContent={`diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,80 +1,80 @@
${lines.map((line) => `-${line}`).join("\n")}
${lines.map((line) => `+${line} updated`).join("\n")}`}
        isLoading={false}
        diffViewMode="unified"
        toggleDiffViewMode={() => {}}
      />,
    ),
    { width: 120, height: 12 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
    for (let i = 0; i < 4; i += 1) {
      await testSetup?.mockMouse.scroll(118, 6, "down");
      await testSetup?.renderOnce();
    }
  });

  const textLines = testSetup
    .captureSpans()
    .lines.map((line) => line.spans.map((span) => span.text).join(""));

  expect(textLines.some((line) => line.includes("line 5"))).toBe(true);
  expect(textLines.some((line) => /line 1(?!\d)/.test(line) && line.includes(" - "))).toBe(
    false,
  );
});

test("code panel selection keeps text after scrolling off screen", async () => {
  const lines = Array.from({ length: 60 }, (_, i) => `line ${i + 1}`);

  testSetup = await testRender(
    withToastProvider(
      <DiffPane
        theme={theme}
        selectedFile="src/app.ts"
        selectedFileKey="compare:src/app.ts"
        selectedFileInfo={null}
        diffContent={`diff --git a/src/app.ts b/src/app.ts
index 1111111..2222222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,60 +1,60 @@
${lines.map((line) => `-${line}`).join("\n")}
${lines.map((line) => `+${line} updated`).join("\n")}`}
        isLoading={false}
        diffViewMode="unified"
        toggleDiffViewMode={() => {}}
      />,
    ),
    { width: 120, height: 12 },
  );

  await act(async () => {
    await testSetup?.renderOnce();
    await testSetup?.mockMouse.drag(8, 5, 22, 6);
    await testSetup?.renderOnce();
    for (let i = 0; i < 2; i += 1) {
      await testSetup?.mockMouse.scroll(118, 6, "down");
      await testSetup?.renderOnce();
    }
  });

  const selectedText = testSetup?.renderer.getSelection()?.getSelectedText() ?? "";
  expect(selectedText.length).toBeGreaterThan(0);
  expect(selectedText).toContain("line");
});
