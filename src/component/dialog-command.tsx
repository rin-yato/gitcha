import { useKeyboard } from "@opentui/react";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Theme } from "../context/theme/provider";
import { useDialog } from "../ui/dialog";
import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select";

export type CommandOption = {
  id: string;
  label: string;
  description?: string;
  category?: string;
  keybind?: string;
  slash?: string;
  run: () => void;
};

export type DialogCommandProps = {
  theme: Theme;
  options: CommandOption[];
  suggested?: CommandOption[];
};

export function DialogCommand(props: DialogCommandProps) {
  const dialog = useDialog();
  const [filter, setFilter] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectOptions = useMemo<DialogSelectOption<string>[]>(() => {
    const all: DialogSelectOption<string>[] = [];

    // Add suggested commands first
    if (props.suggested && props.suggested.length > 0) {
      for (const cmd of props.suggested) {
        all.push({
          title: cmd.label,
          value: cmd.id,
          description: cmd.description,
          footer: cmd.keybind,
          category: "Suggested",
        });
      }
    }

    // Add all commands
    for (const cmd of props.options) {
      all.push({
        title: cmd.label,
        value: cmd.id,
        description: cmd.description,
        footer: cmd.keybind,
        category: cmd.category,
      });
    }

    return all;
  }, [props.options, props.suggested]);

  // Filter options
  const filtered = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return selectOptions;
    return selectOptions.filter(
      (opt) =>
        opt.title.toLowerCase().includes(needle) ||
        opt.description?.toLowerCase().includes(needle) ||
        opt.category?.toLowerCase().includes(needle),
    );
  }, [selectOptions, filter]);

  // Reset selection when filter changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filter]);

  // Clamp selection when options change
  useEffect(() => {
    if (filtered.length === 0) {
      setSelectedIndex(0);
    } else if (selectedIndex >= filtered.length) {
      setSelectedIndex(filtered.length - 1);
    }
  }, [filtered.length, selectedIndex]);

  const move = useCallback(
    (direction: number) => {
      if (filtered.length === 0) return;
      setSelectedIndex((prev) => {
        let next = prev + direction;
        if (next < 0) next = filtered.length - 1;
        if (next >= filtered.length) next = 0;
        return next;
      });
    },
    [filtered.length],
  );

  const handleSelect = useCallback(
    (option: DialogSelectOption<string>) => {
      const cmd = props.options.find((c) => c.id === option.value);
      cmd?.run();
      dialog.closeTop();
    },
    [props.options, dialog],
  );

  const handleConfirm = useCallback(() => {
    if (filtered.length === 0) return;
    const option = filtered[selectedIndex];
    if (option) handleSelect(option);
  }, [filtered, selectedIndex, handleSelect]);

  // Handle keyboard navigation
  useKeyboard((event) => {
    // Arrow up or Ctrl+p
    if (event.name === "up" || (event.ctrl && event.name === "p")) {
      event.preventDefault();
      move(-1);
      return;
    }
    // Arrow down or Ctrl+n
    if (event.name === "down" || (event.ctrl && event.name === "n")) {
      event.preventDefault();
      move(1);
      return;
    }
    // Enter to confirm
    if (event.name === "return") {
      event.preventDefault();
      handleConfirm();
      return;
    }
    // Escape to close
    if (event.name === "escape") {
      event.preventDefault();
      dialog.closeTop();
      return;
    }
  });

  const handleFilterChange = useCallback((value: string) => {
    setFilter(value);
  }, []);

  return (
    <DialogSelect
      theme={props.theme}
      title="Commands"
      placeholder="Search commands..."
      options={selectOptions}
      onSelect={handleSelect}
      onClose={() => dialog.closeTop()}
      filter={filter}
      onFilterChange={handleFilterChange}
      selectedIndex={selectedIndex}
    />
  );
}
