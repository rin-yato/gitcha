import { useDialog } from "@/component/ui/dialog";
import { DialogSelect, type DialogSelectOption } from "@/component/ui/dialog-select";

import { useCallback } from "react";

import type { Theme } from "@/context/theme/provider";

type DialogSelectOptionValue = DialogSelectOption<string>;

export type CommandOption = {
  id: string;
  label: string;
  category?: string;
  slash?: string;
  run: () => void;
};

export type DialogCommandProps = {
  theme: Theme;
  options: DialogSelectOptionValue[];
  commands: Record<string, CommandOption>;
};

export function DialogCommand(props: DialogCommandProps) {
  const dialog = useDialog();

  const handleSelect = useCallback(
    (option: DialogSelectOptionValue) => {
      const cmd = props.commands[option.value];
      cmd?.run();
    },
    [props.commands, dialog],
  );

  return (
    <box padding={1} backgroundColor={props.theme.surface}>
      <DialogSelect
        theme={props.theme}
        title="Commands"
        placeholder="Search commands..."
        options={props.options}
        onSelect={handleSelect}
        width={76}
        height={24}
      />
    </box>
  );
}
