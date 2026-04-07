import { useCallback, useMemo } from "react";

import type { Theme } from "../context/theme/provider";
import { useDialog } from "../ui/dialog";
import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select";

export type CommandOption = {
  id: string;
  label: string;
  category?: string;
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

  const selectOptions = useMemo<DialogSelectOption<string>[]>(() => {
    const all: DialogSelectOption<string>[] = [];

    if (props.suggested && props.suggested.length > 0) {
      for (const cmd of props.suggested) {
        all.push({
          title: cmd.label,
          value: cmd.id,
          description: cmd.slash,
          group: "Suggested",
        });
      }
    }

    for (const cmd of props.options) {
      all.push({
        title: cmd.label,
        value: cmd.id,
        description: cmd.slash,
        group: cmd.category,
      });
    }

    return all;
  }, [props.options, props.suggested]);

  const handleSelect = useCallback(
    (option: DialogSelectOption<string>) => {
      const cmd = props.options.find((c) => c.id === option.value);
      cmd?.run();
      dialog.closeTop();
    },
    [props.options, dialog],
  );

  return (
    <box width="100%" height="100%" justifyContent="center" alignItems="center">
      <box width={76} height={24} backgroundColor="#f7f7f7">
        <DialogSelect
          theme={props.theme}
          title="Commands"
          placeholder="Search commands..."
          options={selectOptions}
          onSelect={handleSelect}
          onClose={() => dialog.closeTop()}
        />
      </box>
    </box>
  );
}
