import {
  type InputRenderable,
  RGBA,
  type ScrollBoxRenderable,
  TextAttributes,
} from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";
import { useTerminalDimensions } from "@opentui/solid";

import { batch, createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js/store";

import { $theme } from "@/store/theme.store";

import { getScrollAcceleration } from "@/lib/scroll";

import { isDeepEqual } from "remeda";

import { getSelectListHeight, getSelectRowsHeight } from "./height";
import { buildRowsFromGroups, getFilteredOptions, groupFilteredOptions } from "./logic";
import { Option } from "./option";
import type { SelectOption, SelectProps, SelectRef, SelectState } from "./types";

export { getSelectListHeight, getSelectRowsHeight } from "./height";
export { buildSelectRows } from "./logic";
export type {
  FilteredGroup,
  FilteredOption,
  SelectHeightInput,
  SelectOption,
  SelectProps,
  SelectRef,
  SelectRow,
} from "./types";

export function Select<T>(props: SelectProps<T>) {
  const scrollAcceleration = getScrollAcceleration();
  const dimensions = useTerminalDimensions();
  const filterEnabled = createMemo(
    () => props.skipFilter !== true && props.renderFilter !== false,
  );

  const [inputTarget, setInputTarget] = createSignal<InputRenderable | undefined>(undefined);
  const [store, setStore] = createStore<SelectState>({
    selected: 0,
    filter: "",
    input: "keyboard",
  });

  const filtered = createMemo(() =>
    getFilteredOptions(props.options, store.filter, !filterEnabled()),
  );
  const flatten = createMemo(() => Boolean(props.flat && store.filter.length > 0));
  const grouped = createMemo(() => groupFilteredOptions(filtered(), flatten()));
  const rows = createMemo(() => buildRowsFromGroups(grouped()));
  const rowsHeight = createMemo(() => getSelectRowsHeight(rows()));
  const selected = createMemo(() => filtered()[store.selected]);
  const listHeight = createMemo(() =>
    getSelectListHeight({
      contentHeight: rowsHeight(),
      terminalHeight: dimensions().height,
      height: props.height,
      filterEnabled: filterEnabled(),
    }),
  );

  let scroll: ScrollBoxRenderable | undefined;

  const ref: SelectRef<T> = {
    get filter() {
      return store.filter;
    },
    get filtered() {
      return filtered().map((entry) => entry.option);
    },
  };
  props.ref?.(ref);

  createEffect(() => {
    const itemCount = filtered().length;

    if (itemCount === 0) {
      if (store.selected !== 0) setStore("selected", 0);
      return;
    }

    if (store.selected >= itemCount) {
      setStore("selected", itemCount - 1);
    }
  });

  createEffect(() => {
    const items = filtered();
    const filterValue = store.filter;
    const current = props.current;

    const timeout = setTimeout(() => {
      if (items.length === 0) return;

      // Filtering changes the result set identity, so reset selection to the
      // strongest match instead of preserving a now-arbitrary old index.
      if (filterValue.length > 0) {
        moveTo(0, true);
        return;
      }

      if (current !== undefined) {
        const currentIndex = items.findIndex((option) =>
          isCurrentOption(option.option, current),
        );
        if (currentIndex >= 0) {
          moveTo(currentIndex, true);
        }
      }
    }, 0);

    return () => clearTimeout(timeout);
  });

  createEffect<string | undefined>((previousFilter) => {
    const nextFilter = store.filter;
    if (previousFilter !== undefined && previousFilter !== nextFilter) {
      setStore("input", "keyboard");
    }
    return nextFilter;
  });

  useBindings<InputRenderable>(() => ({
    target: inputTarget,
    targetMode: "focus",

    commands: [
      ...(props.onClose
        ? [
            {
              name: "select.close",
              run: () => props.onClose?.(),
            },
          ]
        : []),
      {
        name: "select.move-up",
        run: () => move(-1),
      },
      {
        name: "select.move-down",
        run: () => move(1),
      },
      {
        name: "select.page-up",
        run: () => move(-10),
      },
      {
        name: "select.page-down",
        run: () => move(10),
      },
      {
        name: "select.move-home",
        run: () => moveTo(0),
      },
      {
        name: "select.move-end",
        run: () => moveTo(filtered().length - 1),
      },
      {
        name: "select.submit",
        run: () => submit(),
      },
    ],

    bindings: [
      ...(props.onClose ? [{ key: "escape", cmd: "select.close" }] : []),

      { key: "up", cmd: "select.move-up" },
      { key: "down", cmd: "select.move-down" },
      { key: "ctrl+p", cmd: "select.move-up" },
      { key: "ctrl+n", cmd: "select.move-down" },

      { key: "pageup", cmd: "select.page-up" },
      { key: "pagedown", cmd: "select.page-down" },

      { key: "home", cmd: "select.move-home" },
      { key: "end", cmd: "select.move-end" },

      { key: "return", cmd: "select.submit" },
    ],
  }));

  function moveTo(next: number, center = false) {
    const items = filtered();
    if (items.length === 0) return;

    const wrapped = ((next % items.length) + items.length) % items.length;
    setStore("selected", wrapped);

    const option = items[wrapped];
    if (!option) return;

    props.onMove?.(option.option);

    if (!scroll) return;

    const targetRow = rows().find((row) => row.kind === "option" && row.index === wrapped);
    if (!targetRow) return;

    const target = scroll.getChildren().find((child: { id?: string }) => {
      return child.id === targetRow.key;
    });
    if (!target) return;

    // OpenTUI ScrollBox exposes content children, not DOM nodes. Use the child
    // coordinates relative to the scrollbox to keep keyboard selection visible.
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

    triggerOption(option.option);
  }

  function triggerOption(option: SelectOption<T>) {
    option.onSelect?.();
    props.onSelect?.(option);
  }

  return (
    <box gap={1} height={props.height}>
      <box paddingLeft={3} paddingRight={3}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={$theme.token.fg} attributes={TextAttributes.BOLD}>
            {props.title}
          </text>
          <Show when={props.onClose}>
            <text fg={$theme.token.fgMuted} onMouseUp={() => props.onClose?.()}>
              esc
            </text>
          </Show>
        </box>
        <Show when={filterEnabled()}>
          <box paddingTop={1}>
            <input
              focused
              ref={setInputTarget}
              onInput={(value) => {
                batch(() => {
                  setStore("filter", value);
                  props.onFilter?.(value);
                });
              }}
              cursorColor={$theme.token.accent}
              focusedTextColor={$theme.token.fgMuted}
              focusedBackgroundColor={$theme.token.surface}
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
          flexGrow={1}
          flexShrink={0}
          height={listHeight()}
          maxHeight={listHeight()}
          scrollbarOptions={{ visible: false }}
          scrollAcceleration={scrollAcceleration}
          viewportCulling
          ref={scroll}
        >
          <For each={rows()}>
            {(row, index) => {
              if (row.kind === "group") {
                console.log("rendering group", row);
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

              const active = () => row.index === store.selected;
              const current = createMemo(
                () => props.current !== undefined && isCurrentOption(row.option, props.current),
              );

              return (
                <box
                  id={row.key}
                  flexDirection="row"
                  position="relative"
                  onMouseMove={() => {
                    setStore("input", "mouse");
                  }}
                  onMouseUp={() => {
                    triggerOption(row.option);
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

function isCurrentOption<T>(option: SelectOption<T>, current: T) {
  return isDeepEqual(option.value, current);
}
