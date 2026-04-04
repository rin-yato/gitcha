import { testRender } from "@opentui/react/test-utils";

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
