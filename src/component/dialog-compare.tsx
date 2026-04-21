import { useKeyboard } from "@opentui/react";

import { useCallback, useEffect, useMemo, useState } from "react";

import type { Theme } from "@/context/theme/provider";

import type { CompareMode, CompareTarget } from "@/lib/git";

import { DialogSelect, type DialogSelectOption } from "@/component/ui/dialog-select";

const compareTabs = [
  { name: "Base branch", description: "Compare against a branch", value: "base-branch" },
  {
    name: "Base commit",
    description: "Compare current changes against a commit",
    value: "base-commit",
  },
  { name: "Single commit", description: "Show the commit itself", value: "single-commit" },
] as const;

export type CompareBranchOption = {
  ref: string;
  label: string;
  description?: string;
};

export type CompareCommitOption = {
  ref: string;
  message: string;
  origin: string;
};

export interface CompareDialogProps {
  theme: Theme;
  branches: CompareBranchOption[];
  commits: CompareCommitOption[];
  currentBranch: string | null;
  activeCompareTarget: CompareTarget | null;
  defaultCompareTarget: CompareTarget | null;
  onQueryChange: (query: string) => void;
  onSelect: (target: CompareTarget) => void;
  onClose: () => void;
}

function buildBranchOptions(
  branches: CompareBranchOption[],
  currentBranch: string | null,
  defaultCompareTarget: CompareTarget | null,
): DialogSelectOption<string>[] {
  return [
    ...(defaultCompareTarget?.mode === "base-branch"
      ? [
          {
            title: defaultCompareTarget.label,
            value: defaultCompareTarget.ref,
            description: "Nearest merged branch",
            category: "Nearest branch",
          },
        ]
      : []),
    ...branches
      .filter((branch) => branch.ref !== currentBranch)
      .map((branch) => ({
        title: branch.label,
        value: branch.ref,
        description:
          branch.description ?? (branch.ref === currentBranch ? "Current branch" : undefined),
        category: "Branches",
      })),
  ];
}

function buildCommitOptions(commits: CompareCommitOption[]): DialogSelectOption<string>[] {
  return commits.map((commit) => ({
    title: commit.message,
    value: commit.ref,
    description: commit.origin,
    category: "Commits",
  }));
}

export function CompareDialog(props: CompareDialogProps) {
  const {
    theme,
    branches,
    commits,
    currentBranch,
    activeCompareTarget,
    defaultCompareTarget,
    onQueryChange,
    onSelect,
    onClose,
  } = props;
  const [mode, setMode] = useState<CompareMode>(
    activeCompareTarget?.mode ?? defaultCompareTarget?.mode ?? "base-branch",
  );

  useEffect(() => {
    if (activeCompareTarget?.mode) {
      setMode(activeCompareTarget.mode);
      return;
    }

    if (defaultCompareTarget?.mode) {
      setMode(defaultCompareTarget.mode);
    }
  }, [activeCompareTarget?.mode, defaultCompareTarget?.mode]);

  const options = useMemo(() => {
    if (mode === "base-commit" || mode === "single-commit") return buildCommitOptions(commits);
    return buildBranchOptions(branches, currentBranch, defaultCompareTarget);
  }, [branches, commits, currentBranch, defaultCompareTarget, mode]);

  const handleSelect = useCallback(
    (option: DialogSelectOption<string>) => {
      onSelect({ mode, ref: option.value, label: option.title });
    },
    [mode, onSelect],
  );

  const handleQueryChange = useCallback(
    (query: string) => {
      onQueryChange(query);
    },
    [onQueryChange],
  );

  useKeyboard((event) => {
    if (event.name === "[" || event.name === "left") {
      event.preventDefault();
      const currentIndex = compareTabs.findIndex((tab) => tab.value === mode);
      const prevIndex = (currentIndex - 1 + compareTabs.length) % compareTabs.length;
      const newMode = compareTabs[prevIndex]?.value;
      if (!newMode) return;
      setMode(newMode);
    }

    if (event.name === "]" || event.name === "right") {
      event.preventDefault();
      const currentIndex = compareTabs.findIndex((tab) => tab.value === mode);
      const nextIndex = (currentIndex + 1) % compareTabs.length;
      const newMode = compareTabs[nextIndex]?.value;
      if (!newMode) return;
      setMode(newMode);
    }
  });

  return (
    <box width={92} height={28} backgroundColor={theme.surface}>
      <box paddingX={3} paddingTop={1} flexDirection="row" gap={1}>
        {compareTabs.map((tab) => {
          const selected = tab.value === mode;

          return (
            <box
              key={tab.value}
              paddingX={1}
              backgroundColor={selected ? theme.accent : `${theme.border}40`}
              onMouseUp={() => setMode(tab.value)}
            >
              <text
                fg={selected ? theme.background : theme.text}
                attributes={1}
                selectable={false}
              >
                {tab.name}
              </text>
            </box>
          );
        })}
      </box>

      <box paddingTop={1} paddingX={2} height={"100%"}>
        <DialogSelect
          theme={theme}
          title={
            mode === "single-commit"
              ? "Compare to commit"
              : mode === "base-commit"
                ? "Compare to base commit"
                : "Compare to branch"
          }
          placeholder={
            mode === "base-commit" || mode === "single-commit"
              ? "Filter commits..."
              : "Filter branches..."
          }
          options={options}
          onFilter={handleQueryChange}
          onSelect={handleSelect}
          onClose={onClose}
          height={24}
        />
      </box>
    </box>
  );
}
