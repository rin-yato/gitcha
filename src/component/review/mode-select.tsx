import { $dialog } from "@/store/dialog.store";
import { $theme } from "@/store/theme.store";

import { Select } from "@/component/ui/select";
import type { SelectOption } from "@/component/ui/select/types";

import { CommitPicker } from "./commit-picker";

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
  return (
    <box width={50} backgroundColor={$theme.token.surface} padding={1}>
      <Select
        title="Review Mode"
        options={MODE_OPTIONS}
        skipFilter
        onClose={() => $dialog.action.close()}
        onSelect={(option) => {
          $dialog.action.show({
            component: () => <CommitPicker mode={option.value} />,
          });
        }}
      />
    </box>
  );
}
