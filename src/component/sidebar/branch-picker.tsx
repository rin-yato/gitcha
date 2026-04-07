import type { BranchPickerProps } from "./types";

export function BranchPicker(props: BranchPickerProps) {
  const { branches, currentBranch, selectedBranch, onSelectBranch, theme } = props;

  if (branches.length === 0) {
    return (
      <box paddingLeft={1}>
        <text content="No branches found" fg={theme.textMuted} selectable={false} />
      </box>
    );
  }

  return (
    <box flexDirection="column" paddingBottom={1}>
      <box flexDirection="row" paddingLeft={1} paddingBottom={0}>
        <text content="Compare to:" fg={theme.textMuted} attributes={1} selectable={false} />
      </box>

      {branches.map((branch) => {
        const isCurrent = branch === currentBranch;
        const isSelected = branch === selectedBranch;
        const prefix = isSelected ? "▸ " : "  ";
        const label = isCurrent ? `${branch} (current)` : branch;

        return (
          <box
            key={branch}
            onMouseUp={() => onSelectBranch(branch)}
            flexDirection="row"
            paddingLeft={1}
            paddingRight={1}
            backgroundColor={isSelected ? `${theme.accent}16` : undefined}
          >
            <text
              content={`${prefix}${label}`}
              fg={isSelected ? theme.text : isCurrent ? theme.accent : theme.text}
              attributes={isCurrent || isSelected ? 1 : 0}
              selectable={true}
            />
          </box>
        );
      })}
    </box>
  );
}
