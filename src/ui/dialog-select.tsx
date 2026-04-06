import { useKeyboard } from "@opentui/react";

import { useCallback, useMemo, useRef, useState } from "react";

import type { Theme } from "../context/theme/provider";

export interface DialogSelectOption<T = unknown> {
  title: string;
  value: T;
  description?: string;
  category?: string;
}

export interface DialogSelectProps<T> {
  theme: Theme;
  title: string;
  placeholder?: string;
  options: DialogSelectOption<T>[];
  onSelect: (option: DialogSelectOption<T>) => void;
  onClose?: () => void;
}

type GroupedOption<T> = DialogSelectOption<T> & { flatIndex: number };

export function DialogSelect<T>(props: DialogSelectProps<T>) {
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const onSelectRef = useRef(props.onSelect);
  const onCloseRef = useRef(props.onClose);

  onSelectRef.current = props.onSelect;
  onCloseRef.current = props.onClose;

  const groupedOptions = useMemo(() => {
    const needle = filter.trim().toLowerCase();

    const filtered = needle
      ? props.options.filter(
          (opt) =>
            opt.title.toLowerCase().includes(needle) ||
            opt.description?.toLowerCase().includes(needle) ||
            opt.category?.toLowerCase().includes(needle),
        )
      : props.options;

    const groups = new Map<string, DialogSelectOption<T>[]>();

    for (const opt of filtered) {
      const cat = opt.category ?? "";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(opt);
    }

    const result: { category: string; options: GroupedOption<T>[] }[] = [];
    let flatIndex = 0;

    for (const [category, options] of groups) {
      const withIndices: GroupedOption<T>[] = options.map((opt, idx) => ({
        ...opt,
        flatIndex: flatIndex + idx,
      }));
      result.push({ category, options: withIndices });
      flatIndex += options.length;
    }

    return result;
  }, [props.options, filter]);

  const flatLength = useMemo(
    () => groupedOptions.reduce((sum, g) => sum + g.options.length, 0),
    [groupedOptions],
  );

  const flatOptions = useMemo(() => groupedOptions.flatMap((g) => g.options), [groupedOptions]);

  const moveSelection = useCallback(
    (delta: number) => {
      setSelectedIndex((prev) => {
        if (flatLength === 0) return 0;
        return (prev + delta + flatLength) % flatLength;
      });
    },
    [flatLength],
  );

  const confirmSelection = useCallback(() => {
    const option = flatOptions[selectedIndex];
    if (option) {
      onSelectRef.current(option);
    }
  }, [flatOptions, selectedIndex]);

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
    setSelectedIndex(0);
  }, []);

  const handleOptionClick = useCallback((option: GroupedOption<T>) => {
    setSelectedIndex(option.flatIndex);
    onSelectRef.current(option);
  }, []);

  return (
    <box gap={0} paddingBottom={1} paddingTop={1} height="100%" width="100%">
      <box paddingLeft={4} paddingRight={4}>
        <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
          <text fg={props.theme.text} attributes={1} selectable={false}>
            {props.title} - selectedIndex: {selectedIndex}
          </text>
          <text fg={props.theme.textMuted} selectable={false} onMouseUp={onCloseRef.current}>
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

      {flatLength > 0 ? (
        <box flexDirection="column" maxHeight={16}>
          {groupedOptions.map((group, catIdx) => (
            <box key={group.category || `cat_${catIdx}`} flexDirection="column">
              {group.category ? (
                <box paddingTop={catIdx > 0 ? 1 : 0} paddingLeft={4} paddingBottom={1}>
                  <text fg={props.theme.textMuted} attributes={1} selectable={false}>
                    {group.category}
                  </text>
                </box>
              ) : null}
              {group.options.map((option) => {
                const isActive = option.flatIndex === selectedIndex;
                return (
                  <box
                    key={option.flatIndex}
                    flexDirection="row"
                    justifyContent="space-between"
                    backgroundColor={isActive ? props.theme.accent : undefined}
                    paddingLeft={4}
                    paddingRight={4}
                    paddingTop={0}
                    paddingBottom={0}
                    onMouseUp={() => handleOptionClick(option)}
                  >
                    <box flexDirection="row" justifyContent="space-between" flexGrow={1}>
                      <box flexDirection="row" flexGrow={1}>
                        <text
                          fg={isActive ? props.theme.background : props.theme.text}
                          attributes={1}
                          selectable={false}
                          overflow="hidden"
                        >
                          {option.title} - index: {option.flatIndex}
                        </text>
                      </box>

                      {option.description ? (
                        <text
                          fg={isActive ? props.theme.background : props.theme.textMuted}
                          selectable={false}
                          overflow="hidden"
                        >
                          {option.description}
                        </text>
                      ) : null}
                    </box>
                  </box>
                );
              })}
            </box>
          ))}
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
