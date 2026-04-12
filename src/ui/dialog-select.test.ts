import { buildDialogSelectRows, type DialogSelectOption } from "./dialog-select";

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

describe("buildDialogSelectRows", () => {
  const paletteOptions: DialogSelectOption[] = [
    { title: "Compare", value: "toggle-compare", description: "v", category: "Suggested" },
    { title: "Refresh", value: "refresh", description: "r", category: "Suggested" },
    {
      title: "Diff View",
      value: "toggle-diff-view",
      description: "space",
      category: "Suggested",
    },
    { title: "Compare", value: "toggle-compare", description: "v", category: "View" },
    { title: "Diff View", value: "toggle-diff-view", description: "space", category: "View" },
    { title: "Exit Compare", value: "exit-compare", category: "View" },
    { title: "Refresh", value: "refresh", description: "r", category: "Action" },
    { title: "Stage", value: "stage-file", description: "s", category: "Action" },
    { title: "Unstage", value: "unstage-file", description: "u", category: "Action" },
    { title: "Discard", value: "discard-file", description: "x", category: "Action" },
    { title: "Narrow Sidebar", value: "shrink-sidebar", description: "[", category: "Layout" },
    { title: "Wider Sidebar", value: "grow-sidebar", description: "]", category: "Layout" },
  ];

  test("builds grouped rows in input order", () => {
    const rows = buildDialogSelectRows(paletteOptions, "");

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

  test("filters by title and description", () => {
    expect(stripRowKeys(buildDialogSelectRows(paletteOptions, "space"))).toEqual(
      stripRowKeys([
        { kind: "group", key: "group:Suggested", label: "Suggested" },
        {
          kind: "option",
          key: "option:Suggested:0:Diff View",
          group: "Suggested",
          option: {
            title: "Diff View",
            value: "toggle-diff-view",
            description: "space",
            category: "Suggested",
          },
          index: 0,
        },
        { kind: "group", key: "group:View", label: "View" },
        {
          kind: "option",
          key: "option:View:1:Diff View",
          group: "View",
          option: {
            title: "Diff View",
            value: "toggle-diff-view",
            description: "space",
            category: "View",
          },
          index: 1,
        },
      ]),
    );

    expect(stripRowKeys(buildDialogSelectRows(paletteOptions, "side"))).toEqual(
      stripRowKeys([
        { kind: "group", key: "group:Layout", label: "Layout" },
        {
          kind: "option",
          key: "option:Layout:0:Wider Sidebar",
          group: "Layout",
          option: {
            title: "Wider Sidebar",
            value: "grow-sidebar",
            description: "]",
            category: "Layout",
          },
          index: 0,
        },
        {
          kind: "option",
          key: "option:Layout:1:Narrow Sidebar",
          group: "Layout",
          option: {
            title: "Narrow Sidebar",
            value: "shrink-sidebar",
            description: "[",
            category: "Layout",
          },
          index: 1,
        },
      ]),
    );
  });

  test("ranks title matches ahead of description matches", () => {
    const rows = buildDialogSelectRows(
      [
        { title: "Alpha Command", value: "alpha", description: "shared", category: "Actions" },
        { title: "Other", value: "beta", description: "Alpha shortcut", category: "Actions" },
      ],
      "alpha",
    );

    expect(stripRowKeys(rows)).toEqual(
      stripRowKeys([
        { kind: "group", key: "group:Actions", label: "Actions" },
        {
          kind: "option",
          key: "option:Actions:0:Alpha Command",
          group: "Actions",
          option: {
            title: "Alpha Command",
            value: "alpha",
            description: "shared",
            category: "Actions",
          },
          index: 0,
        },
        {
          kind: "option",
          key: "option:Actions:1:Other",
          group: "Actions",
          option: {
            title: "Other",
            value: "beta",
            description: "Alpha shortcut",
            category: "Actions",
          },
          index: 1,
        },
      ]),
    );
  });

  test("omits group headers for ungrouped results", () => {
    const rows = buildDialogSelectRows(
      [
        { title: "Alpha", value: "a" },
        { title: "Beta", value: "b" },
      ],
      "",
    );

    expect(stripRowKeys(rows)).toEqual(
      stripRowKeys([
        {
          kind: "option",
          key: "option::0:Alpha",
          group: "",
          option: { title: "Alpha", value: "a" },
          index: 0,
        },
        {
          kind: "option",
          key: "option::1:Beta",
          group: "",
          option: { title: "Beta", value: "b" },
          index: 1,
        },
      ]),
    );
  });
});
