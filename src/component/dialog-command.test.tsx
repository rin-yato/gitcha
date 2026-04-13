import { afterEach, describe, expect, test } from "bun:test";

import { createSpy } from "@opentui/core/testing";
import { testRender } from "@opentui/react/test-utils";

import { act } from "react";

import type { Theme } from "@/context/theme/provider";

import { DialogProvider, useDialog } from "@/component/ui/dialog";
import type { DialogSelectOption } from "@/component/ui/dialog-select";
import { buildDialogSelectRows } from "@/component/ui/dialog-select";

import { type CommandOption, DialogCommand } from "./dialog-command";

function stripRowKeys(rows: readonly unknown[]) {
  return rows.map((row) => {
    if (typeof row === "object" && row !== null) {
      const clone = { ...(row as Record<string, unknown>) };
      delete clone.key;
      return clone;
    }

    return row;
  });
}

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

function buildTestSelectOptions(
  commands: CommandOption[],
  suggestedIds: string[] = [],
): DialogSelectOption<string>[] {
  const groups = new Map<string, CommandOption[]>();

  const suggested = commands.filter((cmd) => suggestedIds.includes(cmd.id));
  if (suggested.length > 0) {
    groups.set("Suggested", suggested);
  }

  for (const cmd of commands) {
    const cat = cmd.category ?? "";
    const list = groups.get(cat);
    if (list) {
      list.push(cmd);
    } else {
      groups.set(cat, [cmd]);
    }
  }

  return Array.from(groups.entries()).flatMap(([group, cmds]) =>
    cmds.map((cmd) => ({
      title: cmd.label,
      value: cmd.id,
      description: cmd.slash,
      category: group,
    })),
  );
}

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

  async function renderDialog(
    commands: CommandOption[] = testCommands,
    suggestedIds: string[] = [],
  ) {
    const commandsMap = Object.fromEntries(commands.map((cmd) => [cmd.id, cmd]));
    const options = buildTestSelectOptions(commands, suggestedIds);

    testSetup = await testRender(
      <DialogProvider>
        <DialogCommand theme={theme} options={options} commands={commandsMap} />
      </DialogProvider>,
      { width: 80, height: 40 },
    );

    await act(async () => {
      await testSetup?.renderOnce();
    });

    return testSetup;
  }

  async function renderDialogForInput(
    commands: CommandOption[] = testCommands,
    suggestedIds: string[] = [],
  ) {
    const commandsMap = Object.fromEntries(commands.map((cmd) => [cmd.id, cmd]));
    const options = buildTestSelectOptions(commands, suggestedIds);

    testSetup = await testRender(
      <DialogProvider>
        <DialogCommand theme={theme} options={options} commands={commandsMap} />
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
    await renderDialog(testCommands, ["refresh"]);

    const output = JSON.stringify(getSetup().captureSpans().lines);
    expect(output).toContain("Suggested");
  });

  test("shows empty state when no commands", async () => {
    const commandsMap = {};
    const options: DialogSelectOption<string>[] = [];
    testSetup = await testRender(
      <DialogProvider>
        <DialogCommand theme={theme} options={options} commands={commandsMap} />
      </DialogProvider>,
      { width: 80, height: 40 },
    );

    await act(async () => {
      await testSetup?.renderOnce();
    });

    const output = JSON.stringify(getSetup().captureSpans().lines);
    expect(output).toContain("No results found");
  });

  test("single command is displayed", async () => {
    const commands: CommandOption[] = [{ id: "only-one", label: "OnlyOne", run: () => {} }];
    await renderDialog(commands, []);

    const output = JSON.stringify(getSetup().captureSpans().lines);
    expect(output).toContain("OnlyOne");
  });

  test("filters commands immediately while typing", async () => {
    const commands: CommandOption[] = [
      { id: "apple", label: "Apple", run: () => {} },
      { id: "banana", label: "Banana", run: () => {} },
      { id: "cherry", label: "Cherry", run: () => {} },
    ];

    const rows = buildDialogSelectRows(
      commands.map((cmd) => ({ title: cmd.label, value: cmd.id })),
      "ban",
    );

    expect(stripRowKeys(rows)).toEqual(
      stripRowKeys([
        {
          kind: "option",
          key: "option::0:Banana",
          group: "",
          option: { title: "Banana", value: "banana" },
          index: 0,
        },
      ]),
    );
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

    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd1.callCount()).toBe(1);

    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd3.callCount()).toBe(1);

    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd4.callCount()).toBe(1);

    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd2.callCount()).toBe(1);
    expect(cmd4.callCount()).toBe(1);

    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd5.callCount()).toBe(1);

    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd6.callCount()).toBe(1);

    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd7.callCount()).toBe(1);

    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd8.callCount()).toBe(1);

    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd9.callCount()).toBe(1);
  });

  test("navigation with suggested commands and categories", async () => {
    const refresh = createSpy();
    const exitCompare = createSpy();

    const commands: CommandOption[] = [
      { id: "refresh", label: "Refresh", category: "Action", run: refresh },
      { id: "exit-compare", label: "Exit Compare", category: "View", run: exitCompare },
    ];

    await renderDialogForInput(commands, ["refresh"]);

    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressArrow("down");
    await flushInput();

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

    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd1.callCount()).toBe(1);

    testSetup?.mockInput.pressArrow("down");
    await flushInput();

    testSetup?.mockInput.pressEnter();
    await flushInput();

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

    testSetup?.mockInput.pressArrow("down");
    await flushInput();

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

    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd1.callCount()).toBe(0);
    expect(cmd2.callCount()).toBe(1);

    testSetup?.mockInput.pressArrow("down");
    await flushInput();
    testSetup?.mockInput.pressEnter();
    await flushInput();
    expect(cmd1.callCount()).toBe(1);
    expect(cmd2.callCount()).toBe(1);
  });

  test("command can open another dialog", async () => {
    function Launcher() {
      const dialog = useDialog();

      const commands: CommandOption[] = [
        {
          id: "open-theme",
          label: "Theme",
          category: "Appearance",
          run: () => {
            dialog.replace(
              <box>
                <text content="Theme picker" />
              </box>,
            );
          },
        },
      ];

      const commandsMap = Object.fromEntries(commands.map((cmd) => [cmd.id, cmd]));
      const options = buildTestSelectOptions(commands);

      return <DialogCommand theme={theme} options={options} commands={commandsMap} />;
    }

    testSetup = await testRender(
      <DialogProvider>
        <Launcher />
      </DialogProvider>,
      { width: 80, height: 40 },
    );

    await act(async () => {
      await testSetup?.renderOnce();
    });

    testSetup?.mockInput.pressEnter();
    await flushInput();

    const output = JSON.stringify(getSetup().captureSpans().lines);
    expect(output).toContain("Theme picker");
  });

  test("renders the exact command palette rows from App", async () => {
    const commands: CommandOption[] = [
      {
        id: "toggle-compare",
        label: "Compare",
        category: "View",
        slash: "v",
        run: () => {},
      },
      {
        id: "refresh",
        label: "Refresh",
        category: "Action",
        slash: "r",
        run: () => {},
      },
      {
        id: "toggle-diff-view",
        label: "Diff View",
        category: "View",
        slash: "space",
        run: () => {},
      },
      {
        id: "exit-compare",
        label: "Exit Compare",
        category: "View",
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
        id: "unstage-file",
        label: "Unstage",
        category: "Action",
        slash: "u",
        run: () => {},
      },
      {
        id: "discard-file",
        label: "Discard",
        category: "Action",
        slash: "x",
        run: () => {},
      },
      {
        id: "shrink-sidebar",
        label: "Narrow Sidebar",
        category: "Layout",
        slash: "[",
        run: () => {},
      },
      {
        id: "grow-sidebar",
        label: "Wider Sidebar",
        category: "Layout",
        slash: "]",
        run: () => {},
      },
    ];

    const suggestedIds = ["refresh", "toggle-compare", "toggle-diff-view"];

    const rows = buildDialogSelectRows(buildTestSelectOptions(commands, suggestedIds), "");

    expect(stripRowKeys(rows)).toEqual(
      stripRowKeys([
        { kind: "group", key: "group:Suggested", label: "Suggested" },
        {
          kind: "option",
          key: "option:Suggested:0:Compare",
          group: "Suggested",
          option: {
            title: "Compare",
            value: "toggle-compare",
            description: "v",
            category: "Suggested",
          },
          index: 0,
        },
        {
          kind: "option",
          key: "option:Suggested:1:Refresh",
          group: "Suggested",
          option: {
            title: "Refresh",
            value: "refresh",
            description: "r",
            category: "Suggested",
          },
          index: 1,
        },
        {
          kind: "option",
          key: "option:Suggested:2:Diff View",
          group: "Suggested",
          option: {
            title: "Diff View",
            value: "toggle-diff-view",
            description: "space",
            category: "Suggested",
          },
          index: 2,
        },
        { kind: "group", key: "group:View", label: "View" },
        {
          kind: "option",
          key: "option:View:3:Compare",
          group: "View",
          option: {
            title: "Compare",
            value: "toggle-compare",
            description: "v",
            category: "View",
          },
          index: 3,
        },
        {
          kind: "option",
          key: "option:View:4:Diff View",
          group: "View",
          option: {
            title: "Diff View",
            value: "toggle-diff-view",
            description: "space",
            category: "View",
          },
          index: 4,
        },
        {
          kind: "option",
          key: "option:View:5:Exit Compare",
          group: "View",
          option: { title: "Exit Compare", value: "exit-compare", category: "View" },
          index: 5,
        },
        { kind: "group", key: "group:Action", label: "Action" },
        {
          kind: "option",
          key: "option:Action:6:Refresh",
          group: "Action",
          option: { title: "Refresh", value: "refresh", description: "r", category: "Action" },
          index: 6,
        },
        {
          kind: "option",
          key: "option:Action:7:Stage",
          group: "Action",
          option: { title: "Stage", value: "stage-file", description: "s", category: "Action" },
          index: 7,
        },
        {
          kind: "option",
          key: "option:Action:8:Unstage",
          group: "Action",
          option: {
            title: "Unstage",
            value: "unstage-file",
            description: "u",
            category: "Action",
          },
          index: 8,
        },
        {
          kind: "option",
          key: "option:Action:9:Discard",
          group: "Action",
          option: {
            title: "Discard",
            value: "discard-file",
            description: "x",
            category: "Action",
          },
          index: 9,
        },
        { kind: "group", key: "group:Layout", label: "Layout" },
        {
          kind: "option",
          key: "option:Layout:10:Narrow Sidebar",
          group: "Layout",
          option: {
            title: "Narrow Sidebar",
            value: "shrink-sidebar",
            description: "[",
            category: "Layout",
          },
          index: 10,
        },
        {
          kind: "option",
          key: "option:Layout:11:Wider Sidebar",
          group: "Layout",
          option: {
            title: "Wider Sidebar",
            value: "grow-sidebar",
            description: "]",
            category: "Layout",
          },
          index: 11,
        },
      ]),
    );
  });
});
