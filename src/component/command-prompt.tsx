import { useMemo } from "react";

import { type CommandOption, useCommandPrompt } from "../context/command/prompt";
import type { Theme } from "../context/theme/provider";

function clampIndex(index: number, itemCount: number): number {
  if (itemCount === 0) return 0;
  return Math.max(0, Math.min(index, itemCount - 1));
}

export function CommandPrompt(props: {
  theme: Theme;
  options: CommandOption[];
  onSubmit: (option: CommandOption) => void;
}) {
  const prompt = useCommandPrompt();

  const filteredOptions = useMemo(() => {
    const query = prompt.query.trim().toLowerCase();
    if (!query) return props.options;

    return props.options.filter((option) => {
      return (
        option.label.toLowerCase().includes(query) ||
        option.description?.toLowerCase().includes(query)
      );
    });
  }, [props.options, prompt.query]);

  const selectedIndex = clampIndex(prompt.selectedIndex, filteredOptions.length);

  if (!prompt.isOpen) return null;

  return (
    <box
      position="absolute"
      top="20%"
      left="20%"
      width="60%"
      height="50%"
      backgroundColor={props.theme.background}
      border
      borderColor={props.theme.border}
      flexDirection="column"
      padding={1}
      zIndex={100}
    >
      <text fg={props.theme.text} selectable={false}>
        Command
      </text>
      <input
        value={prompt.query}
        onChange={prompt.setQuery}
        placeholder="Type a command..."
        focused
        backgroundColor={props.theme.surface}
        textColor={props.theme.text}
        placeholderColor={props.theme.textMuted}
      />
      <box flexDirection="column" marginTop={1}>
        {filteredOptions.length > 0 ? (
          filteredOptions.map((option, index) => {
            const isSelected = index === selectedIndex;
            return (
              <box
                key={option.id}
                backgroundColor={isSelected ? `${props.theme.accent}12` : undefined}
                paddingX={1}
              >
                <text
                  fg={isSelected ? props.theme.text : props.theme.textMuted}
                  selectable={false}
                >
                  {option.label}
                  {option.description ? `  ${option.description}` : ""}
                </text>
              </box>
            );
          })
        ) : (
          <text fg={props.theme.textMuted} selectable={false}>
            No commands found
          </text>
        )}
      </box>
    </box>
  );
}
