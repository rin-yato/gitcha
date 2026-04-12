import { useCallback } from "react";

import type { Theme } from "../context/theme/provider";
import { useDialog } from "../ui/dialog";
import {
  DialogSelect,
  type DialogSelectOption,
  type DialogSelectOptionGroup,
} from "../ui/dialog-select";
import { Overlay } from "@/ui/overlay";

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
    <Overlay>
      <DialogSelect
        theme={props.theme}
        title="Commands"
        placeholder="Search commands..."
        options={props.options}
        onSelect={handleSelect}
        onClose={() => dialog.closeTop()}
        width={76}
        height={24}
      />
    </Overlay>
  );
}
