import { describe, expect, test } from "bun:test";

import {
  applyExPromptSuggestion,
  buildExPromptSuggestions,
  type ExPromptCommand,
  getExPromptCommandText,
  getExPromptSuggestionRowCount,
  getExPromptSuggestions,
  moveExPromptSelection,
  moveExPromptSelectionInList,
  normalizeExPromptName,
  parseExPromptInput,
} from "./ex-command-input";

const commands: ExPromptCommand[] = [
  {
    name: "quit",
    aliases: ["q"],
    nargs: "0",
    usage: ":quit",
    desc: "Quit gitcha",
  },
  {
    name: "refresh",
    aliases: ["reload", "r"],
    nargs: "0",
    usage: ":refresh",
    desc: "Refresh git status",
  },
  {
    name: "write",
    aliases: ["w"],
    nargs: "1",
    usage: ":write <file>",
    desc: "Write file",
  },
  {
    name: "sidebar",
    aliases: ["sb"],
    nargs: "0",
    usage: ":sidebar",
    desc: "Toggle sidebar",
  },
];

describe("ex command prompt logic", () => {
  test("normalizes command names", () => {
    expect(normalizeExPromptName("quit")).toBe(":quit");
    expect(normalizeExPromptName(":quit")).toBe(":quit");
    expect(normalizeExPromptName("   ")).toBe(":");
  });

  test("parses ex command input", () => {
    expect(parseExPromptInput("write session.log")).toEqual({
      raw: ":write session.log",
      name: ":write",
      args: ["session.log"],
    });
    expect(parseExPromptInput(":")).toBeNull();
  });

  test("builds primary and alias suggestions", () => {
    expect(buildExPromptSuggestions(commands).map((suggestion) => suggestion.label)).toEqual([
      "quit",
      "q",
      "refresh",
      "reload",
      "r",
      "write",
      "w",
      "sidebar",
      "sb",
    ]);
  });

  test("filters suggestions by command prefix", () => {
    expect(
      getExPromptSuggestions(commands, ":re").map((suggestion) => suggestion.label),
    ).toEqual(["refresh", "reload"]);
    expect(
      getExPromptSuggestions(commands, "re").map((suggestion) => suggestion.label),
    ).toEqual(["refresh", "reload"]);
  });

  test("restores suggestions after deleting a query with no matches", () => {
    expect(getExPromptSuggestions(commands, "side-fake-search")).toEqual([]);
    expect(
      getExPromptSuggestions(commands, "side").map((suggestion) => suggestion.label),
    ).toEqual(["sidebar"]);
  });

  test("uses a single fallback row when there are no suggestions", () => {
    expect(getExPromptSuggestionRowCount([])).toBe(1);
    expect(getExPromptSuggestionRowCount(getExPromptSuggestions(commands, "side"))).toBe(1);
    expect(getExPromptSuggestionRowCount(getExPromptSuggestions(commands, ""))).toBe(4);
  });

  test("moves selection with wrapping", () => {
    expect(moveExPromptSelection(commands, ":re", 0, 1)).toBe(1);
    expect(moveExPromptSelection(commands, ":re", 0, -1)).toBe(1);
  });

  test("applies selected suggestion while preserving args", () => {
    expect(applyExPromptSuggestion(commands, "w session.log", 0)).toEqual({
      value: "write session.log",
      selection: 0,
    });
    expect(applyExPromptSuggestion(commands, "w", 0)).toEqual({
      value: "write ",
      selection: 0,
    });
    expect(applyExPromptSuggestion(commands, "q", 0)).toEqual({
      value: "quit",
      selection: 0,
    });
  });

  // --- Edge cases ---

  test("handles empty commands list", () => {
    expect(buildExPromptSuggestions([])).toEqual([]);
  });

  test("deduplicates commands by label", () => {
    const dupes: ExPromptCommand[] = [
      { name: "git", desc: "first" },
      { name: "git", desc: "second" },
    ];
    const suggestions = buildExPromptSuggestions(dupes);
    expect(suggestions.length).toBe(1);
  });

  test("produces correct expectsArgs for all nargs values", () => {
    const withNargs = (nargs: string): ExPromptCommand[] => [{ name: "cmd", nargs }];

    expect(buildExPromptSuggestions(withNargs("0"))[0]?.expectsArgs).toBe(false);
    expect(buildExPromptSuggestions(withNargs("1"))[0]?.expectsArgs).toBe(true);
    expect(buildExPromptSuggestions(withNargs("?"))[0]?.expectsArgs).toBe(true);
    expect(buildExPromptSuggestions(withNargs("*"))[0]?.expectsArgs).toBe(true);
    expect(buildExPromptSuggestions(withNargs("+"))[0]?.expectsArgs).toBe(true);
  });

  test("returns first N suggestions when query is empty", () => {
    const suggestions = getExPromptSuggestions(commands, "", 2);
    expect(suggestions.length).toBe(2);
  });

  test("substring match excludes non-matching prefixes", () => {
    const extended: ExPromptCommand[] = [
      ...commands,
      { name: "git", aliases: ["g"], desc: "Run git commands" },
    ];
    const suggestions = getExPromptSuggestions(extended, ":g");
    const labels = suggestions.map((s) => s.label);
    expect(labels).toContain("git");
    expect(labels).toContain("g");
    expect(labels).not.toContain("quit");
  });

  test("moveExPromptSelectionInList wraps at both ends", () => {
    const suggestions = buildExPromptSuggestions(commands);
    const lastIndex = suggestions.length - 1;

    expect(moveExPromptSelectionInList(suggestions, lastIndex, 1)).toBe(0);
    expect(moveExPromptSelectionInList(suggestions, 0, -1)).toBe(lastIndex);
  });

  test("getExPromptCommandText returns undefined for non-string field", () => {
    expect(
      getExPromptCommandText({ usage: 123 as unknown } as ExPromptCommand, "usage"),
    ).toBeUndefined();
  });
});
