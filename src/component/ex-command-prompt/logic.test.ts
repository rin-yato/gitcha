import { describe, expect, test } from "bun:test";

import {
  applyExPromptSuggestion,
  buildExPromptSuggestions,
  type ExPromptCommand,
  getExPromptSuggestionRowCount,
  getExPromptSuggestions,
  moveExPromptSelection,
  normalizeExPromptName,
  parseExPromptInput,
} from "./logic";

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
});
