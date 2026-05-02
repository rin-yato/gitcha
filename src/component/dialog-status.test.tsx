import { afterEach, expect, test } from "bun:test";

import { testRender } from "@opentui/react/test-utils";

import { act } from "react";

import type { Theme } from "@/context/theme/provider";

import { createLatestReleaseLookup } from "@/lib/release";

import { StatusDialog } from "./dialog-status";

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

test("status dialog renders diagnostics", async () => {
  try {
    testSetup = await testRender(
      <StatusDialog
        theme={theme}
        gitRoot="/work/repo"
        onClose={() => {}}
        releaseLookup={createLatestReleaseLookup(
          async () => new Response(JSON.stringify({ tag_name: "v0.1.7" }), { status: 200 }),
        )}
      />,
      { width: 100, height: 30 },
    );

    await act(async () => {
      await testSetup?.renderOnce();
    });

    const output = JSON.stringify(testSetup.captureSpans().lines);
    expect(output).toContain("Status");
    expect(output).toContain("Watcher");
    expect(output).toContain("Version");
    expect(output).toContain("New version");
    expect(output).toContain("/work/repo");
    expect(output).toContain("v0.1.7");
  } finally {
    testSetup = null;
  }
});
