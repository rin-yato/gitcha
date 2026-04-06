import { createSpy } from "@opentui/core/testing";
import { testRender } from "@opentui/react/test-utils";

import { act } from "react";

import type { Theme } from "../context/theme/provider";
import { DialogProvider } from "../ui/dialog";
import { type CommandOption, DialogCommand } from "./dialog-command";
import { afterEach, describe, expect, test } from "bun:test";

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

const testCommands: CommandOption[] = [
  {
    id: "refresh",
    label: "Refresh",
    category: "Action",
    slash: "r",
    run: () => {},
  },
  {
    id: "toggle-view",
    label: "Compare",
    category: "View",
    slash: "v",
    run: () => {},
  },
  {
    id: "stage-file",
    label: "Stage",
    category: "Action",
    slash: "s",
    run: () => {},
  },
  {
    id: "compare",
    label: "Diff View",
    category: "View",
    run: () => {},
  },
];

describe("DialogCommand", () => {
  let testSetup: Awaited<ReturnType<typeof testRender>> | null = null;

  afterEach(() => {
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
    if (testSetup) {
      act(() => {
        testSetup?.renderer.destroy();
      });
      testSetup = null;
    }
  });

  async function renderDialog(options = testCommands, suggested?: CommandOption[]) {
    testSetup = await testRender(
      <DialogProvider>
        <DialogCommand theme={theme} options={options} suggested={suggested} />
      </DialogProvider>,
      { width: 80, height: 40 },
    );

    await act(async () => {
      await testSetup?.renderOnce();
    });

    return testSetup;
  }

  async function renderDialogForInput(options = testCommands, suggested?: CommandOption[]) {
    testSetup = await testRender(
      <DialogProvider>
        <DialogCommand theme={theme} options={options} suggested={suggested} />
      </DialogProvider>,
      { width: 80, height: 40 },
    );

    await testSetup.renderOnce();
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = false;

    return testSetup;
  }

  function getSetup() {
    if (!testSetup) throw new Error("test setup not initialized");
    return testSetup;
  }

  async function flushInput(delayMs = 20) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await testSetup?.renderOnce();
  }

  test("renders all commands", async () => {
    await renderDialog();

    const output = JSON.stringify(getSetup().captureSpans().lines);
    expect(output).toContain("Refresh");
    expect(output).toContain("Compare");
    expect(output).toContain("Stage");
    expect(output).toContain("Diff View");
  });

  test("renders command categories", async () => {
    await renderDialog();

    const output = JSON.stringify(getSetup().captureSpans().lines);
    expect(output).toContain("Action");
    expect(output).toContain("View");
  });

  test("renders commands as labels", async () => {
    await renderDialog();

    const output = JSON.stringify(getSetup().captureSpans().lines);
    expect(output).toContain("Refresh");
    expect(output).toContain("Compare");
    expect(output).toContain("Stage");
    expect(output).toContain("r");
    expect(output).toContain("v");
    expect(output).toContain("s");
  });

  test("renders suggested section", async () => {
    const suggested = testCommands.filter((c) => c.id === "refresh");
    await renderDialog(testCommands, suggested);

    const output = JSON.stringify(getSetup().captureSpans().lines);
    expect(output).toContain("Suggested");
  });

  test("shows empty state when no commands", async () => {
    await renderDialog([]);

    const output = JSON.stringify(getSetup().captureSpans().lines);
    expect(output).toContain("No results found");
  });

  test("single command is displayed", async () => {
    await renderDialog([{ id: "only-one", label: "OnlyOne", run: () => {} }]);

    const output = JSON.stringify(getSetup().captureSpans().lines);
    expect(output).toContain("OnlyOne");
  });

  test("filters commands immediately while typing", async () => {
    const commands: CommandOption[] = [
      { id: "apple", label: "Apple", run: () => {} },
      { id: "banana", label: "Banana", run: () => {} },
      { id: "cherry", label: "Cherry", run: () => {} },
    ];

    await renderDialogForInput(commands);

    await testSetup?.mockInput.typeText("ban");
    await flushInput();

    const output = testSetup?.captureCharFrame() ?? "";
    expect(output).toContain("Banana");
    expect(output).not.toContain("Apple");
    expect(output).not.toContain("Cherry");
  });

  test("arrow keys navigate and enter runs selected command", async () => {
    const first = createSpy();
    const second = createSpy();
    const third = createSpy();

    const commands: CommandOption[] = [
      { id: "first", label: "First", run: first },
      { id: "second", label: "Second", run: second },
      { id: "third", label: "Third", run: third },
    ];

    await renderDialogForInput(commands);

    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();

    expect(first.callCount()).toBe(0);
    expect(second.callCount()).toBe(1);
    expect(third.callCount()).toBe(0);
  });

  test("ctrl+n and ctrl+p navigate like arrow keys", async () => {
    const first = createSpy();
    const second = createSpy();
    const third = createSpy();

    const commands: CommandOption[] = [
      { id: "first", label: "First", run: first },
      { id: "second", label: "Second", run: second },
      { id: "third", label: "Third", run: third },
    ];

    await renderDialogForInput(commands);

    testSetup?.mockInput.pressKey("n", { ctrl: true });
    await flushInput();
    testSetup?.mockInput.pressKey("p", { ctrl: true });
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();

    expect(first.callCount()).toBe(1);
    expect(second.callCount()).toBe(0);
    expect(third.callCount()).toBe(0);
  });

  test("continuous navigation through categorized commands", async () => {
    const cmd1 = createSpy();
    const cmd2 = createSpy();
    const cmd3 = createSpy();
    const cmd4 = createSpy();
    const cmd5 = createSpy();
    const cmd6 = createSpy();
    const cmd7 = createSpy();
    const cmd8 = createSpy();
    const cmd9 = createSpy();

    const commands: CommandOption[] = [
      { id: "toggle-compare", label: "Compare", category: "View", slash: "v", run: cmd1 },
      { id: "refresh", label: "Refresh", category: "Action", slash: "r", run: cmd2 },
      {
        id: "toggle-diff-view",
        label: "Diff View",
        category: "View",
        slash: "space",
        run: cmd3,
      },
      { id: "exit-compare", label: "Exit Compare", category: "View", run: cmd4 },
      { id: "stage-file", label: "Stage", category: "Action", slash: "s", run: cmd5 },
      { id: "unstage-file", label: "Unstage", category: "Action", slash: "u", run: cmd6 },
      { id: "discard-file", label: "Discard", category: "Action", slash: "x", run: cmd7 },
      {
        id: "shrink-sidebar",
        label: "Narrow Sidebar",
        category: "Layout",
        slash: "[",
        run: cmd8,
      },
      { id: "grow-sidebar", label: "Wider Sidebar", category: "Layout", slash: "]", run: cmd9 },
    ];

    await renderDialogForInput(commands);

    // Flat list order after grouping: View(toggle-compare,toggle-diff-view,exit-compare),
    // Action(refresh,stage-file,unstage-file,discard-file), Layout(shrink-sidebar,grow-sidebar)
    // Initial selection is index 0 (toggle-compare, View)
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd1.callCount()).toBe(1); // Compare

    // Navigate down to index 1 (toggle-diff-view, View)
    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd3.callCount()).toBe(1); // Diff View

    // Navigate down to index 2 (exit-compare, View)
    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd4.callCount()).toBe(1); // Exit Compare

    // Navigate down to index 3 (refresh, Action)
    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd2.callCount()).toBe(1); // Refresh
    expect(cmd4.callCount()).toBe(1);

    // Navigate down to index 4 (stage-file, Action)
    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd5.callCount()).toBe(1); // Stage

    // Navigate down to index 5 (unstage-file, Action)
    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd6.callCount()).toBe(1); // Unstage

    // Navigate down to index 6 (discard-file, Action)
    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd7.callCount()).toBe(1); // Discard

    // Navigate down to index 7 (shrink-sidebar, Layout)
    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd8.callCount()).toBe(1); // Narrow Sidebar

    // Navigate down to index 8 (grow-sidebar, Layout)
    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd9.callCount()).toBe(1); // Wider Sidebar
  });

  test("navigation with suggested commands and categories", async () => {
    const refresh = createSpy();
    const exitCompare = createSpy();

    const commands: CommandOption[] = [
      { id: "refresh", label: "Refresh", category: "Action", run: refresh },
      { id: "exit-compare", label: "Exit Compare", category: "View", run: exitCompare },
    ];

    const suggested = commands.filter((c) => c.id === "refresh");

    await renderDialogForInput(commands, suggested);

    // Initial on Refresh (index 0)
    // Suggested: Refresh (index 0), then: Refresh (index 1), Exit Compare (index 2)

    // Navigate to Exit Compare (index 2)
    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressArrow("down");
    await flushInput();

    // Press Enter on Exit Compare
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(exitCompare.callCount()).toBe(1);
  });

  test("navigation after selection - selection should move", async () => {
    const cmd1 = createSpy();
    const cmd2 = createSpy();

    const commands: CommandOption[] = [
      { id: "first", label: "First", run: cmd1 },
      { id: "second", label: "Second", run: cmd2 },
    ];

    await renderDialogForInput(commands);

    // Select first item
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd1.callCount()).toBe(1);

    // Navigate to second
    testSetup?.mockInput.pressArrow("down");
    await flushInput();

    // Verify selection moved by pressing Enter
    testSetup?.mockInput.pressEnter();
    await flushInput();

    // cmd1 should not have been called again, cmd2 should be called once
    expect(cmd1.callCount()).toBe(1);
    expect(cmd2.callCount()).toBe(1);
  });

  test("navigation without closing dialog", async () => {
    const refresh = createSpy();
    const exitCompare = createSpy();

    const commands: CommandOption[] = [
      { id: "refresh", label: "Refresh", category: "Action", run: refresh },
      { id: "exit-compare", label: "Exit Compare", category: "View", run: exitCompare },
    ];

    await renderDialogForInput(commands);

    // Initial at index 0 (refresh)
    testSetup?.mockInput.pressArrow("down");
    await flushInput();

    // Should be at index 1 (exit-compare)
    testSetup?.mockInput.pressEnter();
    await flushInput();

    expect(refresh.callCount()).toBe(0);
    expect(exitCompare.callCount()).toBe(1);
  });

  test("navigation wraps around from last to first", async () => {
    const cmd1 = createSpy();
    const cmd2 = createSpy();

    const commands: CommandOption[] = [
      { id: "first", label: "First", run: cmd1 },
      { id: "second", label: "Second", run: cmd2 },
    ];

    await renderDialogForInput(commands);

    // Go down from index 0 to 1
    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd1.callCount()).toBe(0);
    expect(cmd2.callCount()).toBe(1);

    // Go down from index 1 to 0 (wrap)
    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd1.callCount()).toBe(1);
    expect(cmd2.callCount()).toBe(1);
  });
});
