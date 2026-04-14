import "@/test-setup";

import { afterEach, describe, expect, test } from "bun:test";

import { createTestRenderer } from "@opentui/core/testing";
import { createRoot } from "@opentui/react";

import { act, type ReactNode, useEffect, useRef } from "react";

import { ReviewDiffProvider, useReviewDiff } from "../diff";
import { ReviewLayoutProvider } from "../layout";
import { ReviewSelectionProvider, useReviewSelection } from "../selection";
import { ReviewViewProvider, useReviewView } from "../view";
import { createFakeGitClient } from "./fake-client";
import { ReviewProvider, useReviewSession } from "./session";

function Probe(props: { exitAfterEnter?: boolean }) {
  const selection = useReviewSelection();
  const diff = useReviewDiff();
  const view = useReviewView();
  const git = useReviewSession();
  const enteredRef = useRef(false);
  const exitedRef = useRef(false);

  useEffect(() => {
    if (enteredRef.current) return;
    if (!git.defaultCompareTarget) return;
    enteredRef.current = true;
    void view.enterCompareMode(git.defaultCompareTarget);
  }, [git.defaultCompareTarget, view]);

  useEffect(() => {
    if (!props.exitAfterEnter) return;
    if (exitedRef.current) return;
    if (view.viewMode !== "compare") return;
    exitedRef.current = true;
    view.exitCompareMode();
  }, [props.exitAfterEnter, view]);

  return (
    <box>
      <text
        content={`mode=${view.viewMode};base=${git.compareState?.baseRef ?? "none"};branches=${git.branches.join(
          ",",
        )};file=${selection.visibleFiles[0]?.path ?? "none"};selected=${selection.selectedFile ?? "none"}`}
      />
      <text content={`diff=${diff.diffContent ?? "none"}`} />
    </box>
  );
}

describe("fake git dev project", () => {
  let testSetup: Awaited<ReturnType<typeof mountReviewTree>> | null = null;

  afterEach(() => {
    if (testSetup) {
      testSetup.destroy();
      testSetup = null;
    }
  });

  async function mountReviewTree(ui: ReactNode) {
    const globalAct = globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT?: boolean;
    };
    const previousActEnvironment = globalAct.IS_REACT_ACT_ENVIRONMENT;
    globalAct.IS_REACT_ACT_ENVIRONMENT = true;

    const setup = await createTestRenderer({ width: 160, height: 24 });
    const root = createRoot(setup.renderer);

    await act(async () => {
      root.render(ui);
    });

    return {
      renderer: setup.renderer,
      renderOnce: setup.renderOnce,
      captureSpans: setup.captureSpans,
      destroy: () =>
        act(() => {
          root.unmount();
          setup.renderer.destroy();
          globalAct.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
        }),
      flush: async (delayMs = 10) => {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
          await setup.renderOnce();
        });
      },
    };
  }

  test("selects the first compare file on entry", async () => {
    const backend = createFakeGitClient();
    testSetup = await mountReviewTree(
      <ReviewProvider client={backend}>
        <ReviewSelectionProvider>
          <ReviewDiffProvider>
            <ReviewViewProvider>
              <ReviewLayoutProvider>
                <Probe />
              </ReviewLayoutProvider>
            </ReviewViewProvider>
          </ReviewDiffProvider>
        </ReviewSelectionProvider>
      </ReviewProvider>,
    );

    await testSetup.flush();
    await testSetup.flush();

    const output = JSON.stringify(testSetup.captureSpans().lines);
    expect(output).toContain("branches=feat/a,feat/b,master");
    expect(output).toContain("base=feat/a");
    expect(output).toContain("mode=compare");
    expect(output).toContain("file=src/ui/panel.renamed.tsx");
    expect(output).toContain("diff=Index: src/ui/panel.renamed.tsx");
    expect(output).toContain("selected=src/ui/panel.renamed.tsx");
  });

  test("selects the first staging file on exit", async () => {
    const backend = createFakeGitClient();
    testSetup = await mountReviewTree(
      <ReviewProvider client={backend}>
        <ReviewSelectionProvider>
          <ReviewDiffProvider>
            <ReviewViewProvider>
              <ReviewLayoutProvider>
                <Probe exitAfterEnter />
              </ReviewLayoutProvider>
            </ReviewViewProvider>
          </ReviewDiffProvider>
        </ReviewSelectionProvider>
      </ReviewProvider>,
    );

    await testSetup.flush();
    await testSetup.flush();
    await testSetup.flush();

    const output = JSON.stringify(testSetup.captureSpans().lines);
    expect(output).toContain("mode=staging");
    expect(output).toContain("selected=docs/README.md");
  });
});
