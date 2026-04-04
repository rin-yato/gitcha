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
    description: "Reload status",
    category: "Action",
    keybind: "r",
    run: () => {},
  },
  {
    id: "toggle-view",
    label: "Toggle View",
    description: "Switch views",
    category: "View",
    keybind: "v",
    run: () => {},
  },
  {
    id: "stage-file",
    label: "Stage File",
    description: "Stage current file",
    category: "Action",
    keybind: "s",
    run: () => {},
  },
  {
    id: "compare",
    label: "Compare Mode",
    description: "Enter compare mode",
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
    expect(output).toContain("Toggle View");
    expect(output).toContain("Stage File");
    expect(output).toContain("Compare Mode");
  });

  test("renders command categories", async () => {
    await renderDialog();

    const output = JSON.stringify(getSetup().captureSpans().lines);
    expect(output).toContain("Action");
    expect(output).toContain("View");
  });

  test("renders command keybinds", async () => {
    await renderDialog();

    const output = JSON.stringify(getSetup().captureSpans().lines);
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
    await renderDialog([
      { id: "only-one", label: "OnlyOne", description: "test", run: () => {} },
    ]);

    const output = JSON.stringify(getSetup().captureSpans().lines);
    expect(output).toContain("OnlyOne");
  });

  test("filters commands immediately while typing", async () => {
    const commands: CommandOption[] = [
      { id: "apple", label: "Apple Command", description: "red fruit", run: () => {} },
      { id: "banana", label: "Banana Command", description: "yellow fruit", run: () => {} },
      { id: "cherry", label: "Cherry Command", description: "red fruit", run: () => {} },
    ];

    await renderDialogForInput(commands);

    await testSetup?.mockInput.typeText("ban");
    await flushInput();

    const output = testSetup?.captureCharFrame() ?? "";
    expect(output).toContain("Banana Command");
    expect(output).not.toContain("Apple Command");
    expect(output).not.toContain("Cherry Command");
  });

  test("filters by description immediately while typing", async () => {
    const commands: CommandOption[] = [
      { id: "fruit", label: "Fruit", description: "apple", run: () => {} },
      { id: "veggie", label: "Vegetable", description: "carrot", run: () => {} },
    ];

    await renderDialogForInput(commands);

    await testSetup?.mockInput.typeText("carrot");
    await flushInput();

    const output = testSetup?.captureCharFrame() ?? "";
    expect(output).toContain("Vegetable");
    expect(output).not.toContain("Fruit");
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
});
