import { useKeyboard } from "@opentui/react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Theme } from "../context/theme/provider";

export interface DialogSelectOption<T = unknown> {
  title: string;
  value: T;
  description?: string;
  group?: string;
}

export interface DialogSelectProps<T> {
  theme: Theme;
  title: string;
  placeholder?: string;
  options: DialogSelectOption<T>[];
  onSelect: (option: DialogSelectOption<T>) => void;
  onClose?: () => void;
}

type VisibleRow<T> =
  | {
      kind: "group";
      key: string;
      label: string;
    }
  | {
      kind: "option";
      key: string;
      group: string;
      option: DialogSelectOption<T>;
    };

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function matchesFilter<T>(option: DialogSelectOption<T>, needle: string) {
  if (!needle) return true;

  return (
    option.title.toLowerCase().includes(needle) ||
    option.description?.toLowerCase().includes(needle) ||
    option.group?.toLowerCase().includes(needle)
  );
}

function scoreOption<T>(option: DialogSelectOption<T>, needle: string) {
  if (!needle) return 0;

  const title = option.title.toLowerCase();
  const description = option.description?.toLowerCase() ?? "";
  const group = option.group?.toLowerCase() ?? "";

  if (title === needle) return 0;
  if (title.startsWith(needle)) return 1;
  if (title.includes(needle)) return 2;
  if (description.includes(needle)) return 3;
  if (group.includes(needle)) return 4;
  return 10;
}

function buildVisibleRows<T>(options: DialogSelectOption<T>[], filter: string) {
  const needle = normalize(filter);
  const filtered = options
    .filter((option) => matchesFilter(option, needle))
    .map((option, index) => ({ option, index, score: scoreOption(option, needle) }))
    .sort((a, b) => a.score - b.score || a.index - b.index);

  const rows: VisibleRow<T>[] = [];
  const groups = new Map<string, DialogSelectOption<T>[]>();

  for (const { option } of filtered) {
    const group = option.group?.trim() || "";
    const list = groups.get(group);
    if (list) {
      list.push(option);
    } else {
      groups.set(group, [option]);
    }
  }

  for (const [group, groupedOptions] of groups) {
    if (group) {
      rows.push({ kind: "group", key: `group:${group}`, label: group });
    }

    for (const option of groupedOptions) {
      rows.push({
        kind: "option",
        key: `option:${group}:${String(option.title)}:${String(option.value)}`,
        group,
        option,
      });
    }
  }

  return rows;
}

export function DialogSelect<T>(props: DialogSelectProps<T>) {
  const [filter, setFilter] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const onSelectRef = useRef(props.onSelect);
  const onCloseRef = useRef(props.onClose);

  onSelectRef.current = props.onSelect;
  onCloseRef.current = props.onClose;

  const rows = useMemo(() => buildVisibleRows(props.options, filter), [props.options, filter]);

  const optionRows = useMemo(
    () =>
      rows.filter(
        (row): row is Extract<VisibleRow<T>, { kind: "option" }> => row.kind === "option",
      ),
    [rows],
  );

  useEffect(() => {
    if (optionRows.length === 0) {
      setActiveKey(null);
      return;
    }

    setActiveKey((current) => {
      if (current && optionRows.some((row) => row.key === current)) {
        return current;
      }

      return optionRows[0]?.key ?? null;
    });
  }, [optionRows]);

  const activeIndex = useMemo(
    () => optionRows.findIndex((row) => row.key === activeKey),
    [activeKey, optionRows],
  );

  const activeOption = activeIndex >= 0 ? optionRows[activeIndex]?.option : undefined;

  const moveSelection = useCallback(
    (delta: number) => {
      if (optionRows.length === 0) return;

      setActiveKey((current) => {
        const currentIndex = current ? optionRows.findIndex((row) => row.key === current) : -1;
        const baseIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = (baseIndex + delta + optionRows.length) % optionRows.length;
        return optionRows[nextIndex]?.key ?? null;
      });
    },
    [optionRows],
  );

  const confirmSelection = useCallback(() => {
    if (!activeOption) return;
    onSelectRef.current(activeOption);
  }, [activeOption]);

  useKeyboard((event) => {
    if (event.name === "up" || (event.ctrl && event.name === "p")) {
      event.preventDefault();
      moveSelection(-1);
    } else if (event.name === "down" || (event.ctrl && event.name === "n")) {
      event.preventDefault();
      moveSelection(1);
    } else if (event.name === "return") {
      event.preventDefault();
      confirmSelection();
    } else if (event.name === "escape") {
      event.preventDefault();
      onCloseRef.current?.();
    }
  });

  const handleInput = useCallback((value: string) => {
    setFilter(value);
  }, []);

  const handleOptionClick = useCallback((row: Extract<VisibleRow<T>, { kind: "option" }>) => {
    setActiveKey(row.key);
    onSelectRef.current(row.option);
  }, []);

  return (
    <box gap={0} paddingBottom={1} paddingTop={1} height="100%" width="100%">
      <box paddingLeft={4} paddingRight={4}>
        <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
          <text fg={props.theme.text} attributes={1} selectable={false}>
            {props.title}
          </text>
          <text
            fg={props.theme.textMuted}
            selectable={false}
            onMouseUp={() => onCloseRef.current?.()}
          >
            esc
          </text>
        </box>
        <box paddingTop={0}>
          <input
            value={filter}
            onInput={handleInput}
            placeholder={props.placeholder ?? "Search..."}
            focused
            backgroundColor={props.theme.surface}
            textColor={props.theme.text}
            placeholderColor={props.theme.textMuted}
          />
        </box>
      </box>

      {optionRows.length > 0 ? (
        <box flexDirection="column" maxHeight={16}>
          {rows.map((row) => {
            if (row.kind === "group") {
              return (
                <box key={row.key} paddingTop={1} paddingLeft={4} paddingBottom={1}>
                  <text fg={props.theme.textMuted} attributes={1} selectable={false}>
                    {row.label}
                  </text>
                </box>
              );
            }

            const isActive = row.key === activeKey;

            return (
              <box
                key={row.key}
                flexDirection="row"
                justifyContent="space-between"
                backgroundColor={isActive ? props.theme.accent : undefined}
                paddingLeft={4}
                paddingRight={4}
                onMouseUp={() => handleOptionClick(row)}
              >
                <box flexDirection="row" justifyContent="space-between" flexGrow={1}>
                  <box flexDirection="row" flexGrow={1}>
                    <text
                      fg={isActive ? props.theme.background : props.theme.text}
                      attributes={1}
                      selectable={false}
                      overflow="hidden"
                    >
                      {row.option.title}
                    </text>
                  </box>

                  {row.option.description ? (
                    <text
                      fg={isActive ? props.theme.background : props.theme.textMuted}
                      selectable={false}
                      overflow="hidden"
                    >
                      {row.option.description}
                    </text>
                  ) : null}
                </box>
              </box>
            );
          })}
        </box>
      ) : (
        <box paddingLeft={4} paddingRight={4} paddingTop={1}>
          <text fg={props.theme.textMuted} selectable={false}>
            No results found
          </text>
        </box>
      )}
    </box>
  );
}
