import { describe, expect, test } from "bun:test";

import { clearDialog, closeDialog, pushDialog, replaceDialog, topDialog } from "./dialog.store";

const first = { component: (() => null) as never };
const second = { component: (() => null) as never };

describe("dialog stack helpers", () => {
  test("pushDialog stacks entries", () => {
    const stack = pushDialog([first], second);

    expect(stack.stack).toEqual([first, second]);
    expect(stack.closed).toEqual([]);
  });

  test("replaceDialog closes existing entries and replaces them", () => {
    const change = replaceDialog([first], second);

    expect(change.stack).toEqual([second]);
    expect(change.closed).toEqual([first]);
  });

  test("closeDialog removes the top entry", () => {
    const change = closeDialog([first, second]);

    expect(change.stack).toEqual([first]);
    expect(change.closed).toEqual([second]);
  });

  test("clearDialog removes every entry", () => {
    const change = clearDialog([first, second]);

    expect(change.stack).toEqual([]);
    expect(change.closed).toEqual([first, second]);
  });

  test("topDialog returns the last entry", () => {
    expect(topDialog([first, second])).toEqual(second);
    expect(topDialog([])).toBeNull();
  });
});
