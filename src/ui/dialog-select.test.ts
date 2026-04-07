import { buildDialogSelectRows, type DialogSelectOptionGroup } from "./dialog-select";

describe("buildDialogSelectRows", () => {
  const paletteOptions: DialogSelectOptionGroup[] = [
    {
      group: "Suggested",
      options: [
        { id: "toggle-compare", title: "Compare", description: "v" },
        { id: "refresh", title: "Refresh", description: "r" },
        { id: "toggle-diff-view", title: "Diff View", description: "space" },
      ],
    },
    {
      group: "View",
      options: [
        { id: "toggle-compare", title: "Compare", description: "v" },
        { id: "toggle-diff-view", title: "Diff View", description: "space" },
        { id: "exit-compare", title: "Exit Compare" },
      ],
    },
    {
      group: "Action",
      options: [
        { id: "refresh", title: "Refresh", description: "r" },
        { id: "stage-file", title: "Stage", description: "s" },
        { id: "unstage-file", title: "Unstage", description: "u" },
        { id: "discard-file", title: "Discard", description: "x" },
      ],
    },
    {
      group: "Layout",
      options: [
        { id: "shrink-sidebar", title: "Narrow Sidebar", description: "[" },
        { id: "grow-sidebar", title: "Wider Sidebar", description: "]" },
      ],
    },
  ];

  test("builds grouped rows in input order", () => {
    const rows = buildDialogSelectRows(paletteOptions, "");

    expect(rows).toEqual([
      { kind: "group", key: "group:Suggested", label: "Suggested" },
      {
        kind: "option",
        key: "option:Suggested:Compare:toggle-compare",
        group: "Suggested",
        option: { id: "toggle-compare", title: "Compare", description: "v" },
      },
      {
        kind: "option",
        key: "option:Suggested:Refresh:refresh",
        group: "Suggested",
        option: { id: "refresh", title: "Refresh", description: "r" },
      },
      {
        kind: "option",
        key: "option:Suggested:Diff View:toggle-diff-view",
        group: "Suggested",
        option: { id: "toggle-diff-view", title: "Diff View", description: "space" },
      },
      { kind: "group", key: "group:View", label: "View" },
      {
        kind: "option",
        key: "option:View:Compare:toggle-compare",
        group: "View",
        option: { id: "toggle-compare", title: "Compare", description: "v" },
      },
      {
        kind: "option",
        key: "option:View:Diff View:toggle-diff-view",
        group: "View",
        option: { id: "toggle-diff-view", title: "Diff View", description: "space" },
      },
      {
        kind: "option",
        key: "option:View:Exit Compare:exit-compare",
        group: "View",
        option: { id: "exit-compare", title: "Exit Compare" },
      },
      { kind: "group", key: "group:Action", label: "Action" },
      {
        kind: "option",
        key: "option:Action:Refresh:refresh",
        group: "Action",
        option: { id: "refresh", title: "Refresh", description: "r" },
      },
      {
        kind: "option",
        key: "option:Action:Stage:stage-file",
        group: "Action",
        option: { id: "stage-file", title: "Stage", description: "s" },
      },
      {
        kind: "option",
        key: "option:Action:Unstage:unstage-file",
        group: "Action",
        option: { id: "unstage-file", title: "Unstage", description: "u" },
      },
      {
        kind: "option",
        key: "option:Action:Discard:discard-file",
        group: "Action",
        option: { id: "discard-file", title: "Discard", description: "x" },
      },
      { kind: "group", key: "group:Layout", label: "Layout" },
      {
        kind: "option",
        key: "option:Layout:Narrow Sidebar:shrink-sidebar",
        group: "Layout",
        option: { id: "shrink-sidebar", title: "Narrow Sidebar", description: "[" },
      },
      {
        kind: "option",
        key: "option:Layout:Wider Sidebar:grow-sidebar",
        group: "Layout",
        option: { id: "grow-sidebar", title: "Wider Sidebar", description: "]" },
      },
    ]);
  });

  test("filters by title and description", () => {
    expect(buildDialogSelectRows(paletteOptions, "space")).toEqual([
      { kind: "group", key: "group:Suggested", label: "Suggested" },
      {
        kind: "option",
        key: "option:Suggested:Diff View:toggle-diff-view",
        group: "Suggested",
        option: { id: "toggle-diff-view", title: "Diff View", description: "space" },
      },
      { kind: "group", key: "group:View", label: "View" },
      {
        kind: "option",
        key: "option:View:Diff View:toggle-diff-view",
        group: "View",
        option: { id: "toggle-diff-view", title: "Diff View", description: "space" },
      },
    ]);

    expect(buildDialogSelectRows(paletteOptions, "side")).toEqual([
      { kind: "group", key: "group:Layout", label: "Layout" },
      {
        kind: "option",
        key: "option:Layout:Narrow Sidebar:shrink-sidebar",
        group: "Layout",
        option: { id: "shrink-sidebar", title: "Narrow Sidebar", description: "[" },
      },
      {
        kind: "option",
        key: "option:Layout:Wider Sidebar:grow-sidebar",
        group: "Layout",
        option: { id: "grow-sidebar", title: "Wider Sidebar", description: "]" },
      },
    ]);
  });

  test("omits group headers for ungrouped results", () => {
    const rows = buildDialogSelectRows(
      [
        {
          group: "",
          options: [
            { id: "a", title: "Alpha" },
            { id: "b", title: "Beta" },
          ],
        },
      ],
      "",
    );

    expect(rows).toEqual([
      {
        kind: "option",
        key: "option::Alpha:a",
        group: "",
        option: { id: "a", title: "Alpha" },
      },
      {
        kind: "option",
        key: "option::Beta:b",
        group: "",
        option: { id: "b", title: "Beta" },
      },
    ]);
  });
});
