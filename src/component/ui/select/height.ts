import { FILTER_HEIGHT, LIST_GAP_HEIGHT, MIN_LIST_HEIGHT, TITLE_HEIGHT } from "./constants";
import type { SelectHeightInput, SelectRow } from "./types";

type SelectRowKind = SelectRow["kind"];

function getChromeHeight(filterEnabled: boolean) {
  return TITLE_HEIGHT + LIST_GAP_HEIGHT + (filterEnabled ? FILTER_HEIGHT : 0);
}

function toRows(value: number) {
  return Number.isFinite(value) ? Math.floor(value) : MIN_LIST_HEIGHT;
}

export function getSelectRowsHeight(rows: readonly { kind: SelectRowKind }[]) {
  return rows.reduce(
    (height, row, index) => height + 1 + (row.kind === "group" && index > 0 ? 1 : 0),
    0,
  );
}

export function getSelectListHeight(input: SelectHeightInput) {
  const containerHeight = toRows(input.height ?? Math.floor(input.terminalHeight / 2));
  const contentHeight = Math.max(MIN_LIST_HEIGHT, toRows(input.contentHeight));

  // `height` is the whole Select, so remove fixed chrome before sizing the
  // scrollbox viewport. The list still clamps to content to avoid empty rows.
  const availableHeight = Math.max(
    MIN_LIST_HEIGHT,
    containerHeight - getChromeHeight(input.filterEnabled),
  );

  return Math.min(contentHeight, availableHeight);
}
