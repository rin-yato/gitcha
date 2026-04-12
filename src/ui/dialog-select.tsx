import type { InputRenderable, ScrollBoxRenderable } from "@opentui/core";
import { flushSync, useKeyboard, useTerminalDimensions } from "@opentui/react";
import fuzzysort from "fuzzysort";
import { entries, flatMap, groupBy, isDeepEqual, pipe } from "remeda";
import { useEffect, useMemo, useRef, useState } from "react";

import type { DialogState } from "./dialog";
import { useDialog } from "./dialog";
import type { Theme } from "../context/theme/provider";
import { useTheme } from "../context/theme/provider";

export interface DialogSelectOption<T = unknown> {
  title: string;
  value: T;
  description?: string;
  category?: string;
  disabled?: boolean;
  onSelect?: (dialog: DialogState) => void;
}

export interface DialogSelectRef<T = unknown> {
  filter: string;
  filtered: DialogSelectOption<T>[];
}

export interface DialogSelectProps<T = unknown> {
  theme?: Theme;
  title: string;
  placeholder?: string;
  options: DialogSelectOption<T>[];
  flat?: boolean;
  current?: T;
  skipFilter?: boolean;
  ref?: (ref: DialogSelectRef<T>) => void;
  onMove?: (option: DialogSelectOption<T>) => void;
  onFilter?: (query: string) => void;
  onSelect?: (option: DialogSelectOption<T>) => void;
  onClose?: () => void;
  width?: number;
  height?: number;
}

type InternalOption<T> = {
  option: DialogSelectOption<T>;
  category: string;
  sourceIndex: number;
  score: number;
};

type VisibleRow<T> =
  | { kind: "group"; label: string }
  | {
      kind: "option";
      group: string;
      option: DialogSelectOption<T>;
      index: number;
    };

type DialogSelectState = {
  selected: number;
  filter: string;
  input: "keyboard" | "mouse";
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function isCurrentValue<T>(current: T | undefined, value: T) {
  return isDeepEqual(current, value);
}

function getFlatOptions<T>(options: DialogSelectOption<T>[]) {
  const flat: InternalOption<T>[] = [];

  for (const option of options) {
    if (option.disabled) continue;

    flat.push({
      option,
      category: option.category?.trim() ?? "",
      sourceIndex: flat.length,
      score: 0,
    });
  }

  return flat;
}

function getFilteredOptions<T>(
  options: DialogSelectOption<T>[],
  filterValue: string,
  skipFilter = false,
) {
  const needle = normalize(filterValue);
  const flat = getFlatOptions(options);

  if (skipFilter || !needle) {
    return flat;
  }

  return fuzzysort
    .go(needle, flat, {
      keys: [
        (entry) => entry.option.title,
        (entry) => entry.category,
        (entry) => entry.option.description ?? "",
      ],
      scoreFn: (result) => {
        const titleScore = result[0]?.score ?? 0;
        const categoryScore = result[1]?.score ?? 0;
        const descriptionScore = result[2]?.score ?? 0;

        return titleScore * 2 + categoryScore + descriptionScore * 0.5;
      },
    })
    .map((entry) => ({
      ...entry.obj,
      score: entry.score,
    }))
    .sort((a, b) => b.score - a.score || a.sourceIndex - b.sourceIndex);
}

function groupFilteredOptions<T>(filtered: InternalOption<T>[], flatten: boolean) {
  if (flatten) return [["", filtered]] as Array<[string, InternalOption<T>[]]>;

  return pipe(
    filtered,
    groupBy((entry) => entry.category),
    entries(),
  );
}

function buildRowsFromGroups<T>(groups: Array<[string, InternalOption<T>[]]>) {
  let index = 0;

  return groups.flatMap(([category, options]) => {
    const rows: VisibleRow<T>[] = [];

    if (category) {
      rows.push({ kind: "group", label: category });
    }

    for (const entry of options) {
      rows.push({
        kind: "option",
        group: category,
        option: entry.option,
        index,
      });
      index += 1;
    }

    return rows;
  });
}

export function buildDialogSelectRows<T>(
  options: DialogSelectOption<T>[],
  filterValue: string,
) {
  return buildRowsFromGroups(
    groupFilteredOptions(getFilteredOptions(options, filterValue), false),
  );
}

export function DialogSelect<T>(props: DialogSelectProps<T>) {
  const dialog = useDialog();
  const defaultTheme = useTheme();
  const theme = props.theme ?? defaultTheme;
  const dimensions = useTerminalDimensions();

  const [state, setState] = useState<DialogSelectState>({
    selected: 0,
    filter: "",
    input: "keyboard",
  });

  const scrollRef = useRef<ScrollBoxRenderable | null>(null);
  const onSelectRef = useRef(props.onSelect);
  const onMoveRef = useRef(props.onMove);
  const onFilterRef = useRef(props.onFilter);
  const onCloseRef = useRef(props.onClose);
  const inputRef = useRef<InputRenderable | null>(null);

  onSelectRef.current = props.onSelect;
  onMoveRef.current = props.onMove;
  onFilterRef.current = props.onFilter;
  onCloseRef.current = props.onClose;

  const filtered = useMemo(
    () => getFilteredOptions(props.options, state.filter, props.skipFilter),
    [props.options, props.skipFilter, state.filter],
  );

  const flatten = Boolean(props.flat && state.filter.length > 0);
  const grouped = useMemo(() => groupFilteredOptions(filtered, flatten), [filtered, flatten]);

  const flat = useMemo(
    () =>
      pipe(
        grouped,
        flatMap(([, options]) => options),
      ),
    [grouped],
  );

  const rows = useMemo(() => buildRowsFromGroups(grouped), [grouped]);

  const maxHeight = useMemo(() => {
    if (props.height !== undefined) return Math.max(1, props.height - 6);

    const halfScreen = Math.max(1, Math.floor(dimensions.height / 2) - 6);
    return Math.max(1, Math.min(rows.length, halfScreen));
  }, [dimensions.height, props.height, rows.length]);

  useEffect(() => {
    if (flat.length === 0) {
      setState((current) => (current.selected === 0 ? current : { ...current, selected: 0 }));
      return;
    }

    setState((current) => {
      if (current.selected >= 0 && current.selected < flat.length) return current;
      return { ...current, selected: 0 };
    });
  }, [flat.length]);

  useEffect(() => {
    if (state.input === "keyboard") return;

    setState((current) => ({ ...current, input: "keyboard" }));
  }, [state.filter]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    input.traits = { status: "FILTER" };

    const timeout = setTimeout(() => {
      if (!inputRef.current || inputRef.current.isDestroyed) return;
      inputRef.current.focus();
    }, 1);

    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (state.filter.length > 0) {
        moveTo(0, true);
        return;
      }

      if (props.current !== undefined) {
        const currentIndex = flat.findIndex((entry) =>
          isCurrentValue(props.current, entry.option.value),
        );
        if (currentIndex >= 0) {
          moveTo(currentIndex, true);
        }
      }
    }, 0);

    return () => clearTimeout(timeout);
  }, [flat, props.current, state.filter]);

  const selected = flat[state.selected] ?? null;
  const selectedOption = selected?.option ?? null;
  const mouseMode = state.input === "mouse";

  useEffect(() => {
    if (!props.ref) return;

    props.ref({
      get filter() {
        return state.filter;
      },
      get filtered() {
        return filtered.map((entry) => entry.option);
      },
    });
  }, [filtered, props.ref, state.filter]);

  function closeDialog() {
    if (onCloseRef.current) {
      onCloseRef.current();
      return;
    }

    dialog.closeTop();
  }

  function triggerOption(option: DialogSelectOption<T>) {
    option.onSelect?.(dialog);
    onSelectRef.current?.(option);
  }

  function moveTo(next: number, center = false) {
    if (flat.length === 0) return;

    const wrapped = ((next % flat.length) + flat.length) % flat.length;
    flushSync(() => {
      setState((current) => ({ ...current, selected: wrapped }));
    });

    const option = flat[wrapped];
    if (!option || !scrollRef.current) return;

    onMoveRef.current?.(option.option);

    const target = scrollRef.current
      .getChildren()
      .find((child) => child.id === `option:${wrapped}`);

    if (!target) return;

    const y = target.y - scrollRef.current.y;
    if (center) {
      const centerOffset = Math.floor(scrollRef.current.height / 2);
      scrollRef.current.scrollBy(y - centerOffset);
      return;
    }

    if (y >= scrollRef.current.height) {
      scrollRef.current.scrollBy(y - scrollRef.current.height + 1);
      return;
    }

    if (y < 0) {
      scrollRef.current.scrollBy(y);
    }
  }

  function move(delta: number) {
    if (flat.length === 0) return;

    moveTo(state.selected + delta, true);
  }

  function confirmSelection() {
    if (!selectedOption) return;

    triggerOption(selectedOption);
  }

  useKeyboard((event) => {
    setState((current) => ({ ...current, input: "keyboard" }));

    if (event.name === "up" || (event.ctrl && event.name === "p")) {
      event.preventDefault();
      move(-1);
    }

    if (event.name === "down" || (event.ctrl && event.name === "n")) {
      event.preventDefault();
      move(1);
    }

    if (event.name === "pageup") {
      event.preventDefault();
      move(-10);
    }

    if (event.name === "pagedown") {
      event.preventDefault();
      move(10);
    }

    if (event.name === "home") {
      event.preventDefault();
      moveTo(0);
    }

    if (event.name === "end") {
      event.preventDefault();
      moveTo(flat.length - 1);
    }

    if (event.name === "return") {
      event.preventDefault();
      confirmSelection();
    }

    if (event.name === "escape") {
      event.preventDefault();
      closeDialog();
    }
  });

  return (
    <box
      gap={1}
      paddingBottom={1}
      width={props.width ?? 76}
      height={props.height}
      backgroundColor={theme.surface}
    >
      <box paddingLeft={4} paddingRight={4}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={theme.text} attributes={1} selectable={false}>
            {props.title}
          </text>
          <text fg={theme.textMuted} selectable={false} onMouseUp={closeDialog}>
            esc
          </text>
        </box>
        <box paddingTop={1}>
          <input
            ref={inputRef}
            value={state.filter}
            onInput={(value) => {
              setState((current) => ({ ...current, filter: value, selected: 0 }));
              onFilterRef.current?.(value);
            }}
            placeholder={props.placeholder ?? "Search"}
            focused
            backgroundColor={theme.surface}
            textColor={theme.text}
            cursorColor={theme.accent}
            placeholderColor={theme.textMuted}
          />
        </box>
      </box>

      {flat.length > 0 ? (
        <scrollbox
          ref={scrollRef}
          scrollbarOptions={{ visible: false }}
          flexGrow={1}
          viewportCulling
          maxHeight={maxHeight}
        >
          {rows.map((row) => {
            if (row.kind === "group") {
              return (
                <box key={`group:${row.label}`} paddingTop={1} paddingLeft={4}>
                  <text fg={theme.accent} attributes={1} selectable={false}>
                    {row.label}
                  </text>
                </box>
              );
            }

            const isActive = row.index === state.selected;
            const rowKey = `option:${row.index}`;

            return (
              <box
                key={rowKey}
                id={rowKey}
                flexDirection="row"
                justifyContent="space-between"
                backgroundColor={isActive ? theme.accent : undefined}
                paddingLeft={4}
                paddingRight={4}
                onMouseMove={() => setState((current) => ({ ...current, input: "mouse" }))}
                onMouseDown={() => moveTo(row.index)}
                onMouseOver={() => {
                  if (!mouseMode) return;
                  moveTo(row.index);
                }}
                onMouseUp={() => triggerOption(row.option)}
              >
                <text
                  fg={isActive ? theme.background : theme.text}
                  selectable={false}
                  overflow="hidden"
                >
                  {row.option.title}
                </text>

                {row.option.description ? (
                  <text
                    fg={isActive ? theme.background : theme.textMuted}
                    selectable={false}
                    overflow="hidden"
                  >
                    {row.option.description}
                  </text>
                ) : null}
              </box>
            );
          })}
        </scrollbox>
      ) : (
        <box paddingLeft={4} paddingRight={4} paddingTop={1}>
          <text fg={theme.textMuted} selectable={false}>
            No results found
          </text>
        </box>
      )}
    </box>
  );
}
