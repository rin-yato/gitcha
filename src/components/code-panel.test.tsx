import { testRender } from "@opentui/react/test-utils";

import { AppStateProvider } from "../states/app";
import { createFakeGitBackend } from "../states/fake-git";
import { GitProvider } from "../states/git";
import type { Theme } from "../styles/theme";
import { CodePanel } from "./code-panel";
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

test("code panel shows an empty state", async () => {
  const setup = await testRender(
    <CodePanel
      theme={theme}
      selectedFile={null}
      selectedFileKey={null}
      diffContent={null}
      diffViewMode="unified"
      toggleDiffViewMode={() => {}}
    />,
    { width: 80, height: 24 },
  );

  await setup.renderOnce();

  expect(JSON.stringify(setup.captureSpans().lines)).toContain("no file selected");
});

test("code panel shows loading state when a file is selected", async () => {
  const setup = await testRender(
    <CodePanel
      theme={theme}
      selectedFile="src/app.ts"
      selectedFileKey="changes:src/app.ts"
      diffContent={null}
      diffViewMode="split"
      toggleDiffViewMode={() => {}}
    />,
    { width: 80, height: 24 },
  );

  await setup.renderOnce();

  expect(JSON.stringify(setup.captureSpans().lines)).toContain("Loading...");
});

test("code panel renders diff content when provided", async () => {
  const backend = createFakeGitBackend();
  const setup = await testRender(
    <GitProvider backend={backend}>
      <AppStateProvider>
        <CodePanel
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
      </AppStateProvider>
    </GitProvider>,
    { width: 120, height: 40 },
  );

  await setup.renderOnce();

  const output = JSON.stringify(setup.captureSpans().lines);
  expect(output).toContain("console.log");
  expect(output).toContain("feat/b");
});
