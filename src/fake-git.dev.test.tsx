import { testRender } from "@opentui/react/test-utils";

import { useEffect, useRef } from "react";

import { createFakeGitClient } from "./fake-client";
import { ReviewProvider, useReviewSession } from "./session";
import { ReviewStateProvider, useReviewState } from "./state";
import { describe, expect, test } from "bun:test";

function Probe() {
  const app = useReviewState();
  const git = useReviewSession();
  const toggledRef = useRef(false);

  useEffect(() => {
    if (toggledRef.current) return;
    if (!git.defaultCompareTarget) return;
    toggledRef.current = true;
    app.toggleViewMode();
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
  test("boots with the fake compare target and files", async () => {
    const backend = createFakeGitClient();
    const setup = await testRender(
      <ReviewProvider client={backend}>
        <ReviewStateProvider>
          <Probe />
        </ReviewStateProvider>
      </ReviewProvider>,
      { width: 80, height: 24 },
    );

    await setup.renderOnce();
    await setup.renderOnce();
    await setup.renderOnce();

    const output = JSON.stringify(setup.captureSpans().lines);
    expect(output).toContain("branches=feat/a,feat/b,master");
    expect(output).toContain("base=feat/a");
    expect(output).toContain("file=src/app.ts");
    expect(output).toContain("diff=diff --git a/src/app.ts b/src/app.ts");
  });
});
