import {
  type InputRenderable,
  RGBA,
  type ScrollBoxRenderable,
  TextAttributes,
} from "@opentui/core";
import { useKeyboard, useTerminalDimensions } from "@opentui/solid";

import { batch, createEffect, createMemo, For, type JSX, Show } from "solid-js";
import { createStore } from "solid-js/store";

import { $dialog } from "@/store/dialog.store";
import { $theme } from "@/store/theme.store";

import { getScrollAcceleration } from "@/lib/scroll";

import * as fuzzysort from "fuzzysort";
import { isDeepEqual } from "remeda";

type DialogSelectState = {
  selected: number;
  filter: string;
  input: "keyboard" | "mouse";
};

type FilteredOption<T> = {
  option: DialogSelectOption<T>;
  category: string;
  sourceIndex: number;
  score: number;
};

type FilteredGroup<T> = {
  category: string;
  options: FilteredOption<T>[];
};

type DialogSelectRow<T> =
  | { kind: "group"; key: string; label: string; categoryView?: JSX.Element }
  | {
      kind: "option";
      key: string;
      group: string;
      option: DialogSelectOption<T>;
      index: number;
    };

export interface DialogSelectProps<T> {
  title: string;
  placeholder?: string;
  options: DialogSelectOption<T>[];
  flat?: boolean;
  ref?: (ref: DialogSelectRef<T>) => void;
  onMove?: (option: DialogSelectOption<T>) => void;
  onFilter?: (query: string) => void;
  onSelect?: (option: DialogSelectOption<T>) => void;
  skipFilter?: boolean;
  renderFilter?: boolean;
  current?: T;
}

export interface DialogSelectOption<T = unknown> {
  title: string;
  value: T;
  description?: string;
  footer?: JSX.Element | string;
  category?: string;
  categoryView?: JSX.Element;
  disabled?: boolean;
  bg?: RGBA;
  gutter?: () => JSX.Element;
  margin?: JSX.Element;
  onSelect?: () => void;
}

export type DialogSelectRef<T> = {
  filter: string;
  filtered: DialogSelectOption<T>[];
};

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getFlatOptions<T>(options: DialogSelectOption<T>[]) {
  const flat: FilteredOption<T>[] = [];

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

function groupFilteredOptions<T>(filtered: FilteredOption<T>[], flatten: boolean) {
  if (flatten) {
    return [{ category: "", options: filtered }] satisfies FilteredGroup<T>[];
  }

  const groups: FilteredGroup<T>[] = [];
  const byCategory = new Map<string, FilteredGroup<T>>();

  for (const entry of filtered) {
    const existing = byCategory.get(entry.category);

    if (existing) {
      existing.options.push(entry);
      continue;
    }

    const nextGroup: FilteredGroup<T> = {
      category: entry.category,
      options: [entry],
    };

    groups.push(nextGroup);
    byCategory.set(entry.category, nextGroup);
  }

  return groups;
}

function buildRowsFromGroups<T>(groups: FilteredGroup<T>[]) {
  const rows: DialogSelectRow<T>[] = [];
  let index = 0;

  for (const group of groups) {
    if (group.category) {
      rows.push({ kind: "group", key: `group:${group.category}`, label: group.category });
    }

    for (const entry of group.options) {
      rows.push({
        kind: "option",
        key: `option:${group.category}:${index}:${entry.option.title}`,
        group: group.category,
        option: entry.option,
        index,
      });
      index += 1;
    }
  }

  return rows;
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
  const scrollAcceleration = getScrollAcceleration();
  const dimensions = useTerminalDimensions();
  const filterEnabled = props.skipFilter !== true && props.renderFilter !== false;

  const [store, setStore] = createStore<DialogSelectState>({
    selected: 0,
    filter: "",
    input: "keyboard",
  });

  const filtered = createMemo(() =>
    getFilteredOptions(props.options, store.filter, !filterEnabled),
  );
  const flatten = createMemo(() => Boolean(props.flat && store.filter.length > 0));
  const grouped = createMemo(() => groupFilteredOptions(filtered(), flatten()));
  const rows = createMemo(() => buildRowsFromGroups(grouped()));
  const selected = createMemo(() => filtered()[store.selected]);

  createEffect(() => {
    const items = filtered();
    const filterValue = store.filter;
    const current = props.current;

    const timeout = setTimeout(() => {
      if (items.length === 0) {
        return;
      }

      if (filterValue.length > 0) {
        moveTo(0, true);
        return;
      }

      if (current !== undefined) {
        const currentIndex = items.findIndex((option) =>
          isDeepEqual(option.option.value, current),
        );
        if (currentIndex >= 0) {
          moveTo(currentIndex, true);
        }
      }
    }, 0);

    return () => clearTimeout(timeout);
  });

  createEffect(() => {
    filtered();
    setStore("input", "keyboard");
  });

  const height = createMemo(() =>
    Math.max(1, Math.min(rows().length, Math.floor(dimensions().height / 2) - 6)),
  );

  let input: InputRenderable;
  let scroll: ScrollBoxRenderable | undefined;

  const ref: DialogSelectRef<T> = {
    get filter() {
      return store.filter;
    },
    get filtered() {
      return filtered().map((entry) => entry.option);
    },
  };
  props.ref?.(ref);

  function moveTo(next: number, center = false) {
    const items = filtered();
    if (items.length === 0) return;

    const wrapped = ((next % items.length) + items.length) % items.length;
    setStore("selected", wrapped);

    const option = items[wrapped];
    if (!option) return;

    props.onMove?.(option.option);

    if (!scroll) return;

    const targetRow = rows().find(
      (row) => row.kind === "option" && isDeepEqual(row.option.value, option.option.value),
    );
    if (!targetRow) return;

    const target = scroll.getChildren().find((child: { id?: string }) => {
      return child.id === targetRow.key;
    });
    if (!target) return;

    const y = target.y - scroll.y;
    if (center) {
      const centerOffset = Math.floor(scroll.height / 2);
      scroll.scrollBy(y - centerOffset);
      return;
    }

    if (y >= scroll.height) {
      scroll.scrollBy(y - scroll.height + 1);
      return;
    }

    if (y < 0) {
      scroll.scrollBy(y);
    }
  }

  function move(direction: number) {
    if (filtered().length === 0) return;

    moveTo(store.selected + direction, true);
  }

  function submit() {
    setStore("input", "keyboard");
    const option = selected();
    if (!option) return;

    option.option.onSelect?.();
    props.onSelect?.(option.option);
  }

  useKeyboard((key) => {
    setStore("input", "keyboard");

    if (key.name === "up") {
      move(-1);
    }

    if (key.name === "down") {
      move(1);
    }

    if (key.name === "pageup") {
      move(-10);
    }

    if (key.name === "pagedown") {
      move(10);
    }

    if (key.name === "home") {
      moveTo(0);
    }

    if (key.name === "end") {
      moveTo(filtered().length - 1);
    }

    if (key.name === "return") {
      submit();
    }

    if (key.name === "escape") {
      $dialog.action.close();
    }
  });

  return (
    <box gap={1} paddingBottom={1}>
      <box paddingLeft={4} paddingRight={4}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={$theme.token.fg} attributes={TextAttributes.BOLD}>
            {props.title}
          </text>
          <text fg={$theme.token.fgMuted} onMouseUp={() => $dialog.action.close()}>
            esc
          </text>
        </box>
        <Show when={filterEnabled}>
          <box paddingTop={1}>
            <input
              onInput={(value) => {
                batch(() => {
                  setStore("filter", value);
                  props.onFilter?.(value);
                });
              }}
              focusedBackgroundColor={$theme.token.surface}
              cursorColor={$theme.token.accent}
              focusedTextColor={$theme.token.fgMuted}
              ref={(r) => {
                input = r;
                input.traits = { status: "FILTER" };
                setTimeout(() => {
                  if (!input || input.isDestroyed) return;
                  input.focus();
                }, 1);
              }}
              placeholder={props.placeholder ?? "Search"}
              placeholderColor={$theme.token.fgMuted}
            />
          </box>
        </Show>
      </box>
      <Show
        when={grouped().length > 0}
        fallback={
          <box paddingLeft={4} paddingRight={4} paddingTop={1}>
            <text fg={$theme.token.fgMuted}>No results found</text>
          </box>
        }
      >
        <scrollbox
          paddingLeft={1}
          paddingRight={1}
          scrollbarOptions={{ visible: false }}
          scrollAcceleration={scrollAcceleration}
          ref={(r: ScrollBoxRenderable) => {
            scroll = r;
          }}
          maxHeight={height()}
        >
          <For each={rows()}>
            {(row, index) => {
              if (row.kind === "group") {
                return (
                  <box paddingTop={index() > 0 ? 1 : 0} paddingLeft={3}>
                    <Show
                      when={row.categoryView}
                      fallback={
                        <text fg={$theme.token.accent} attributes={TextAttributes.BOLD}>
                          {row.label}
                        </text>
                      }
                    >
                      {row.categoryView}
                    </Show>
                  </box>
                );
              }

              const active = createMemo(() =>
                isDeepEqual(row.option.value, selected()?.option.value),
              );
              const current = createMemo(() => isDeepEqual(row.option.value, props.current));

              return (
                <box
                  id={row.key}
                  flexDirection="row"
                  position="relative"
                  onMouseMove={() => {
                    setStore("input", "mouse");
                  }}
                  onMouseUp={() => {
                    row.option.onSelect?.();
                    props.onSelect?.(row.option);
                  }}
                  onMouseOver={() => {
                    if (store.input !== "mouse") return;
                    moveTo(row.index);
                  }}
                  onMouseDown={() => {
                    moveTo(row.index);
                  }}
                  backgroundColor={
                    active()
                      ? (row.option.bg ?? $theme.token.accent)
                      : RGBA.fromInts(0, 0, 0, 0)
                  }
                  paddingLeft={current() || row.option.gutter ? 1 : 3}
                  paddingRight={3}
                  gap={1}
                >
                  <Show when={!current() && row.option.margin}>
                    <box position="absolute" left={1} flexShrink={0}>
                      {row.option.margin}
                    </box>
                  </Show>
                  <Option
                    title={row.option.title}
                    footer={
                      flatten() ? (row.option.category ?? row.option.footer) : row.option.footer
                    }
                    description={
                      row.option.description !== row.group ? row.option.description : undefined
                    }
                    active={active()}
                    current={current()}
                    gutter={row.option.gutter}
                  />
                </box>
              );
            }}
          </For>
        </scrollbox>
      </Show>
    </box>
  );
}

function Option(props: {
  title: string;
  description?: string;
  active?: boolean;
  current?: boolean;
  footer?: JSX.Element | string;
  gutter?: () => JSX.Element;
}) {
  const fg = createMemo(() => {
    if (props.active) return $theme.token.accentFg;
    if (props.current) return $theme.token.accent;
    return $theme.token.fg;
  });

  return (
    <>
      <Show when={props.current}>
        <text flexShrink={0} fg={fg()} marginRight={0}>
          ●
        </text>
      </Show>
      <Show when={!props.current && props.gutter}>
        <box flexShrink={0} marginRight={0}>
          {props.gutter?.()}
        </box>
      </Show>
      <text
        flexGrow={1}
        fg={fg()}
        attributes={props.active ? TextAttributes.BOLD : undefined}
        overflow="hidden"
        wrapMode="none"
        paddingLeft={3}
      >
        {props.title}
        <Show when={props.description}>
          <span style={{ fg: props.active ? $theme.token.accentFg : $theme.token.fgMuted }}>
            {" "}
            {props.description}
          </span>
        </Show>
      </text>
      <Show when={props.footer}>
        <box flexShrink={0}>
          <text fg={props.active ? $theme.token.accentFg : $theme.token.fgMuted}>
            {props.footer}
          </text>
        </box>
      </Show>
    </>
  );
}
