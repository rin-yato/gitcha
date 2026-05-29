import { Select } from "@/component/ui/select";
import type { SelectOption } from "@/component/ui/select/types";

import { CommitPicker } from "./commit-picker";
import { useDialog } from "@/context/dialog";
import { useTheme } from "@/context/theme";

type ReviewMode = "single-commit" | "base-commit";

const MODE_OPTIONS: SelectOption<ReviewMode>[] = [
  {
    title: "Commit",
    value: "single-commit",
    description: "changes in a single commit",
  },
  {
    title: "Since Commit",
    value: "base-commit",
    description: "changes since a commit",
  },
];

export function ModeSelect() {
  const dialog = useDialog();
  const theme = useTheme();

  return (
    <box width={50} backgroundColor={theme.state.token.surface} padding={1}>
      <Select
        title="Review Mode"
        options={MODE_OPTIONS}
        skipFilter
        onClose={() => dialog.close()}
        onSelect={(option) => {
          dialog.show({
            component: () => <CommitPicker mode={option.value} />,
          });
        }}
      />
    </box>
  );
}
