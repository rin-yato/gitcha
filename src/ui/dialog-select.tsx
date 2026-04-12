import { useKeyboard } from "@opentui/react";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { Theme } from "../context/theme/provider";

export interface DialogSelectOption {
  id: string;
  title: string;
  description?: string;
}

export interface DialogSelectOptionGroup {
  group: string;
  options: DialogSelectOption[];
}

export interface DialogSelectProps {
  theme: Theme;
  title: string;
  placeholder?: string;
  options: DialogSelectOptionGroup[];
  onSelect: (option: DialogSelectOption) => void;
  onClose?: () => void;
  width: number;
  height: number;
}

type VisibleRow =
  | { kind: "group"; key: string; label: string }
  | { kind: "option"; key: string; group: string; option: DialogSelectOption };

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function matchesFilter(option: DialogSelectOption, needle: string) {
  if (!needle) return true;

  return (
    option.title.toLowerCase().includes(needle) ||
    option.description?.toLowerCase().includes(needle)
  );
}

function scoreOption(option: DialogSelectOption, needle: string) {
  if (!needle) return 0;

  const title = option.title.toLowerCase();
  const description = option.description?.toLowerCase() ?? "";

  if (title === needle) return 0;
  if (title.startsWith(needle)) return 1;
  if (title.includes(needle)) return 2;
  if (description.includes(needle)) return 3;
  return 10;
}

export function buildDialogSelectRows(optionGroups: DialogSelectOptionGroup[], filter: string) {
  const needle = normalize(filter);

  const allOptionsWithGroup = optionGroups.flatMap(({ group, options }) =>
    options.map((option) => ({ option, group: group ?? "" })),
  );

  const filtered = allOptionsWithGroup
    .filter(({ option }) => matchesFilter(option, needle))
    .map(({ option, group }, index) => ({
      option,
      group,
      index,
      score: scoreOption(option, needle),
    }))
    .sort((a, b) => a.score - b.score || a.index - b.index);

  const rows: VisibleRow[] = [];
  const groups = new Map<string, DialogSelectOption[]>();

  for (const { option, group } of filtered) {
    const trimmedGroup = group?.trim() || "";
    const list = groups.get(trimmedGroup);
    if (list) {
      list.push(option);
    } else {
      groups.set(trimmedGroup, [option]);
    }
  }

  for (const [group, groupedOptions] of groups) {
    if (group) {
      rows.push({ kind: "group", key: `group:${group}`, label: group });
    }

    for (const option of groupedOptions) {
      rows.push({
        kind: "option",
        key: `option:${group}:${option.title}:${option.id}`,
        group,
        option,
      });
    }
  }

  return rows;
}

export function DialogSelect(props: DialogSelectProps) {
  const [filter, setFilter] = useState("");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const onSelectRef = useRef(props.onSelect);
  const onCloseRef = useRef(props.onClose);

  onSelectRef.current = props.onSelect;
  onCloseRef.current = props.onClose;

  const rows = useMemo(
    () => buildDialogSelectRows(props.options, filter),
    [props.options, filter],
  );

  const optionRows = useMemo(
    () =>
      rows.filter(
        (row): row is Extract<VisibleRow, { kind: "option" }> => row.kind === "option",
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

  const activeOption = optionRows.find((row) => row.key === activeKey)?.option;

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

  const handleOptionClick = useCallback((row: Extract<VisibleRow, { kind: "option" }>) => {
    onSelectRef.current(row.option);
  }, []);

  return (
    <box
      gap={0}
      paddingBottom={1}
      paddingTop={1}
      width={props.width}
      height={props.height}
      backgroundColor={props.theme.surface}
    >
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
            onInput={setFilter}
            placeholder={props.placeholder ?? "Search..."}
            focused
            backgroundColor={props.theme.surface}
            textColor={props.theme.text}
            cursorColor={props.theme.accent}
            placeholderColor={props.theme.textMuted}
          />
        </box>
      </box>

      {optionRows.length > 0 ? (
        <scrollbox scrollbarOptions={{ visible: false }} flexGrow={1}>
          {rows.map((row) => {
            if (row.kind === "group") {
              return (
                <box key={row.key} paddingTop={1} paddingLeft={4}>
                  <text fg={props.theme.accent} attributes={1} selectable={false}>
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
                <text
                  fg={isActive ? props.theme.background : props.theme.text}
                  selectable={false}
                  overflow="hidden"
                >
                  {row.option.title}
                </text>

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
            );
          })}
        </scrollbox>
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
