import { flushSync } from "@opentui/react";

import { useCallback } from "react";

import type { Theme } from "@/context/theme/provider";

import { useDialog } from "@/component/ui/dialog";
import { DialogSelect, type DialogSelectOption } from "@/component/ui/dialog-select";
import { Overlay } from "@/component/ui/overlay";

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
      flushSync(() => {
        dialog.closeTop();
      });
      cmd?.run();
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
        width={76}
        height={24}
      />
    </Overlay>
  );
}
