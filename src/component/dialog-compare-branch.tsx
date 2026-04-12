import { useCallback } from "react";

import type { Theme } from "../context/theme/provider";
import type { CompareTarget } from "../git";
import { DialogSelect } from "../ui/dialog-select";
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

  const otherBranches = branches.filter((b) => b !== currentBranch);

  const options = defaultCompareTarget
    ? [
        {
          group: "Nearest branch",
          options: [
            {
              id: defaultCompareTarget.ref,
              title: defaultCompareTarget.label,
              description: "Nearest merged branch",
            },
          ],
        },
        ...(otherBranches.length > 0
          ? [
              {
                group: "Other branches",
                options: otherBranches.map((branch) => ({
                  id: branch,
                  title: branch,
                  description: branch === currentBranch ? "Current branch" : undefined,
                })),
              },
            ]
          : []),
      ]
    : [
        {
          group: "Branches",
          options: branches.map((branch) => ({
            id: branch,
            title: branch,
            description: branch === currentBranch ? "Current branch" : undefined,
          })),
        },
      ];

  const handleSelect = useCallback(
    (option: { id: string; title: string }) => {
      onSelect({ ref: option.id, label: option.title });
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
