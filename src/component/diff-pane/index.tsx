import { memo, useMemo } from "react";

import { createSyntaxStyle, detectFiletype } from "@/context/theme";

import { DiffHeader } from "./diff-header";
import { DiffRenderablePane } from "./diff-renderable-pane";
import type { DiffPaneProps } from "./types";
import { formatHeaderLabel } from "./utils";

const UnsupportedDiffOverlay = memo(function UnsupportedDiffOverlay({
  reason,
  theme,
}: {
  reason: string;
  theme: import("@/context/theme").Theme;
}) {
  return (
    <box
      flexGrow={1}
      paddingX={2}
      paddingY={1}
      border
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      gap={1}
    >
      <ascii-font font="block" text="Gitcha" color={theme.textMuted} />
      <text content="Unsupported file" fg={theme.text} selectable={false} />
      <text content={reason} fg={theme.warning} selectable={false} />
    </box>
  );
});

export const DiffPane = memo(function DiffPane(props: DiffPaneProps) {
  const {
    theme,
    selectedFile,
    selectedFileKey,
    selectedFileInfo,
    diffContent,
    unsupportedReason,
    diffViewMode,
  } = props;

  const filetype = useMemo(() => detectFiletype(selectedFile), [selectedFile]);

  const syntaxStyle = useMemo(() => createSyntaxStyle(theme), [theme]);

  const headerLabel = useMemo(
    () => formatHeaderLabel(selectedFile, selectedFileInfo),
    [selectedFile, selectedFileInfo],
  );

  const showUnsupported = Boolean(selectedFileKey && unsupportedReason != null);

  return (
    <box
      id="code-panel"
      position="relative"
      backgroundColor={theme.background}
      flexGrow={1}
      flexDirection="column"
    >
      <DiffHeader label={headerLabel} viewMode={diffViewMode} theme={theme} />

      {selectedFileKey ? (
        showUnsupported ? (
          <UnsupportedDiffOverlay reason={unsupportedReason!} theme={theme} />
        ) : (
          <DiffRenderablePane
            theme={theme}
            fileKey={selectedFileKey}
            diffContent={diffContent!}
            viewMode={diffViewMode}
            filetype={filetype ?? "text"}
            syntaxStyle={syntaxStyle}
          />
        )
      ) : (
        <box flexGrow={1} alignItems="center" justifyContent="center">
          <ascii-font font="block" text="Gitcha" color={theme.textMuted} />
        </box>
      )}
    </box>
  );
});

export type { DiffPaneProps } from "./types";
