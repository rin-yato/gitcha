import "@/test-setup";

import { afterEach, describe, expect, test } from "bun:test";

import { testRender } from "@opentui/react/test-utils";

import { act, useEffect, useRef } from "react";

import { createFakeGitClient } from "./fake-client";
import { ReviewProvider, useReviewSession } from "./session";
import { ReviewStateProvider, useReviewState } from "./state";

function Probe() {
  const app = useReviewState();
  const git = useReviewSession();
  const enteredRef = useRef(false);

  useEffect(() => {
    if (enteredRef.current) return;
    if (!git.defaultCompareTarget) return;
    enteredRef.current = true;
    app.enterCompareMode(git.defaultCompareTarget);
  }, [app, git.defaultCompareTarget]);

  return (
    <box>
      <text
        content={`mode=${app.viewMode};base=${git.compareState?.baseRef ?? "none"};branches=${git.branches.join(
          ",",
        )};file=${app.visibleFiles[0]?.path ?? "none"}`}
      />
      <text content={`diff=${app.diffContent ?? "none"}`} />
    </box>
  );
}

describe("fake git dev project", () => {
  let testSetup: Awaited<ReturnType<typeof testRender>> | null = null;

  afterEach(() => {
    if (testSetup) {
      act(() => {
        testSetup?.renderer.destroy();
      });
      testSetup = null;
    }
  });

  test("boots with the fake compare target and files", async () => {
    const backend = createFakeGitClient();
    testSetup = await testRender(
      <ReviewProvider client={backend}>
        <ReviewStateProvider>
          <Probe />
        </ReviewStateProvider>
      </ReviewProvider>,
      { width: 80, height: 24 },
    );

    // Yield to let async state updates (getLocalBranches, getRepoStatus, etc.) complete
    await new Promise((resolve) => setTimeout(resolve, 10));

    await act(async () => {
      await testSetup?.renderOnce();
      await testSetup?.renderOnce();
      await testSetup?.renderOnce();
    });

    const output = JSON.stringify(testSetup.captureSpans().lines);
    expect(output).toContain("branches=feat/a,feat/b,master");
    expect(output).toContain("base=feat/a");
    expect(output).toContain("file=src/app.ts");
    expect(output).toContain("diff=Index: src/app.ts");
  });
});
