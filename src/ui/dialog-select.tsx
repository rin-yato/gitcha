import { useCallback, useEffect, useMemo, useState } from "react";

import type { Theme } from "../context/theme/provider";

export interface DialogSelectOption<T = unknown> {
  title: string;
  value: T;
  description?: string;
  footer?: string;
  category?: string;
}

export interface DialogSelectProps<T> {
  theme: Theme;
  title: string;
  placeholder?: string;
  options: DialogSelectOption<T>[];
  onSelect: (option: DialogSelectOption<T>) => void;
  onClose?: () => void;
  current?: T;
  keybinds?: { label: string; keybind: string }[];
  /** External control: pass filter from parent */
  filter?: string;
  onFilterChange?: (value: string) => void;
  /** External control: pass selected index from parent */
  selectedIndex?: number;
}

/**
 * Pure presentation component for selecting from a list of options.
 * Does NOT handle keyboard - parent component should handle that.
 */
export function DialogSelect<T>(props: DialogSelectProps<T>) {
  const [internalFilter, setInternalFilter] = useState("");

  // Use external filter if provided, otherwise internal
  const filter = props.filter ?? internalFilter;
  const setFilter = props.onFilterChange ?? setInternalFilter;

  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return props.options;
    return props.options.filter(
      (opt) =>
        opt.title.toLowerCase().includes(needle) ||
        opt.description?.toLowerCase().includes(needle) ||
        opt.category?.toLowerCase().includes(needle),
    );
  }, [props.options, filter]);

  const grouped = useMemo<[string, DialogSelectOption<T>[]][]>(() => {
    const groups = new Map<string, DialogSelectOption<T>[]>();
    for (const opt of filtered) {
      const cat = opt.category ?? "";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(opt);
    }
    return Array.from(groups.entries());
  }, [filtered]);

  const flat = useMemo(() => grouped.flatMap(([, opts]) => opts), [grouped]);

  // Use external selected index if provided, otherwise default to 0
  const selectedIndex = props.selectedIndex ?? 0;

  const handleSelect = useCallback(
    (option: DialogSelectOption<T>) => {
      props.onSelect(option);
    },
    [props.onSelect],
  );

  return (
    <box gap={1} paddingBottom={1}>
      <box paddingLeft={4} paddingRight={4}>
        <box flexDirection="row" justifyContent="space-between">
          <text fg={props.theme.text} attributes={1} selectable={false}>
            {props.title}
          </text>
          <text fg={props.theme.textMuted} selectable={false} onMouseUp={props.onClose}>
            esc
          </text>
        </box>
        <box paddingTop={1}>
          <input
            value={filter}
            onInput={setFilter}
            placeholder={props.placeholder ?? "Search..."}
            focused
            backgroundColor={props.theme.surface}
            textColor={props.theme.text}
            placeholderColor={props.theme.textMuted}
          />
        </box>
      </box>

      {grouped.length > 0 ? (
        <box flexDirection="column" maxHeight={20}>
          {grouped.map(([category, options], catIdx) => (
            <box key={category || "_"} flexDirection="column">
              {category ? (
                <box paddingTop={catIdx > 0 ? 1 : 0} paddingLeft={4}>
                  <text fg={props.theme.accent} attributes={1} selectable={false}>
                    {category}
                  </text>
                </box>
              ) : null}
              {options.map((option) => {
                const idx = flat.indexOf(option);
                const isActive = idx === selectedIndex;
                const isCurrent = option.value === props.current;
                return (
                  <box
                    key={`${category}-${option.title}`}
                    flexDirection="row"
                    justifyContent="space-between"
                    backgroundColor={isActive ? `${props.theme.accent}12` : undefined}
                    paddingLeft={3}
                    paddingRight={3}
                    onMouseUp={() => handleSelect(option)}
                  >
                    <box flexDirection="row" gap={1}>
                      {isCurrent ? (
                        <text
                          fg={isActive ? props.theme.text : props.theme.accent}
                          selectable={false}
                        >
                          \u25cf
                        </text>
                      ) : (
                        <text selectable={false}> </text>
                      )}
                      <text
                        fg={isActive ? props.theme.text : props.theme.textMuted}
                        attributes={isActive ? 1 : 0}
                        selectable={false}
                        overflow="hidden"
                      >
                        {option.title}
                        {option.description ? (
                          <span fg={isActive ? props.theme.text : props.theme.textMuted}>
                            {" "}
                            {option.description}
                          </span>
                        ) : null}
                      </text>
                    </box>
                    {option.footer ? (
                      <text
                        fg={isActive ? props.theme.text : props.theme.textMuted}
                        selectable={false}
                      >
                        {option.footer}
                      </text>
                    ) : null}
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

      {props.keybinds && props.keybinds.length > 0 ? (
        <box
          paddingLeft={4}
          paddingRight={4}
          flexDirection="row"
          gap={2}
          flexShrink={0}
          paddingTop={1}
        >
          {props.keybinds.map((kb) => (
            <box key={kb.label} flexDirection="row" gap={1}>
              <text fg={props.theme.text} attributes={1} selectable={false}>
                {kb.label}
              </text>
              <text fg={props.theme.textMuted} selectable={false}>
                {kb.keybind}
              </text>
            </box>
          ))}
        </box>
      ) : null}
    </box>
  );
}
