import { memo } from "react";

import type { DiffViewMode } from "@/context/diff";
import type { Theme } from "@/context/theme";

interface DiffHeaderProps {
  label: string;
  viewMode: DiffViewMode;
  theme: Theme;
}

export const DiffHeader = memo(function DiffHeader(props: DiffHeaderProps) {
  const { label, viewMode, theme } = props;

  return (
    <box
      flexDirection="row"
      justifyContent="space-between"
      paddingBottom={1}
      paddingX={1}
      overflow="hidden"
    >
      <text
        content={label}
        fg={theme.text}
        attributes={1}
        selectable={false}
        flexGrow={1}
        flexShrink={1}
        minWidth={0}
        truncate
      />
      <text content={viewMode} fg={theme.textMuted} selectable={false} flexShrink={0} />
    </box>
  );
});
