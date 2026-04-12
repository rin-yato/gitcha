import { useCallback } from "react";

import type { Theme } from "../context/theme/provider";
import type { CompareTarget } from "../git";
import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select";
import { Overlay } from "../ui/overlay";

export interface CompareBranchDialogProps {
  theme: Theme;
  branches: string[];
  currentBranch: string | null;
  defaultCompareTarget: CompareTarget | null;
  onSelect: (target: CompareTarget) => void;
  onClose: () => void;
}

export function CompareBranchDialog(props: CompareBranchDialogProps) {
  const { theme, branches, currentBranch, defaultCompareTarget, onSelect, onClose } = props;

  const options = defaultCompareTarget
    ? ([
        {
          title: defaultCompareTarget.label,
          value: defaultCompareTarget.ref,
          description: "Nearest merged branch",
          category: "Nearest branch",
        },
        ...branches
          .filter((branch) => branch !== currentBranch)
          .map((branch) => ({
            title: branch,
            value: branch,
            description: branch === currentBranch ? "Current branch" : undefined,
            category: "Other branches",
          })),
      ] satisfies DialogSelectOption<string>[])
    : (branches.map((branch) => ({
        title: branch,
        value: branch,
        description: branch === currentBranch ? "Current branch" : undefined,
        category: "Branches",
      })) satisfies DialogSelectOption<string>[]);

  const handleSelect = useCallback(
    (option: DialogSelectOption<string>) => {
      onSelect({ ref: option.value, label: option.title });
    },
    [onSelect],
  );

  return (
    <Overlay>
      <DialogSelect
        theme={theme}
        title="Compare to branch"
        placeholder="Filter branches..."
        options={options}
        onSelect={handleSelect}
        onClose={onClose}
        width={60}
        height={20}
      />
    </Overlay>
  );
}
