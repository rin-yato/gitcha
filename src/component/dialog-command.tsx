import { useCallback } from "react";

import type { Theme } from "../context/theme/provider";
import { useDialog } from "../ui/dialog";
import {
  DialogSelect,
  type DialogSelectOption,
  type DialogSelectOptionGroup,
} from "../ui/dialog-select";

export type CommandOption = {
  id: string;
  label: string;
  category?: string;
  slash?: string;
  run: () => void;
};

export type DialogCommandProps = {
  theme: Theme;
  options: DialogSelectOptionGroup[];
  commands: Record<string, CommandOption>;
};

export function DialogCommand(props: DialogCommandProps) {
  const dialog = useDialog();

  const handleSelect = useCallback(
    (option: DialogSelectOption) => {
      const cmd = props.commands[option.id];
      cmd?.run();
      dialog.closeTop();
    },
    [props.commands, dialog],
  );

  return (
    <box width="100%" height="100%" justifyContent="center" alignItems="center">
      <box width={76} height={24} backgroundColor="#f7f7f7">
        <DialogSelect
          theme={props.theme}
          title="Commands"
          placeholder="Search commands..."
          options={props.options}
          onSelect={handleSelect}
          onClose={() => dialog.closeTop()}
        />
      </box>
    </box>
  );
}
