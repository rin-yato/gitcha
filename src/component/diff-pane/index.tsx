import { memo, useMemo } from "react";

import { createSyntaxStyle, detectFiletype } from "@/context/theme";

import { DiffHeader } from "./diff-header";
import { DiffRenderablePane } from "./diff-renderable-pane";
import type { DiffPaneProps } from "./types";
import { formatHeaderLabel, shouldShowDiff } from "./utils";

const LoadingState = memo(function LoadingState({ color }: { color: string }) {
  return <text content="Loading..." fg={color} selectable={false} />;
});

export const DiffPane = memo(function DiffPane(props: DiffPaneProps) {
  const { theme, selectedFile, selectedFileKey, selectedFileInfo, diffContent, diffViewMode } =
    props;

  const filetype = useMemo(() => detectFiletype(selectedFile), [selectedFile]);

  const syntaxStyle = useMemo(() => createSyntaxStyle(theme), [theme]);

  const headerLabel = useMemo(
    () => formatHeaderLabel(selectedFile, selectedFileInfo),
    [selectedFile, selectedFileInfo],
  );

  const showDiff = shouldShowDiff(selectedFileKey, selectedFile, diffContent);

  return (
    <box id="code-panel" backgroundColor={theme.background} flexGrow={1} flexDirection="column">
      <DiffHeader label={headerLabel} viewMode={diffViewMode} theme={theme} />

      {selectedFileKey ? (
        showDiff ? (
          <box flexGrow={1} flexDirection="column">
            <DiffRenderablePane
              fileKey={selectedFileKey}
              diffContent={diffContent!}
              viewMode={diffViewMode}
              theme={theme}
              filetype={filetype ?? "text"}
              syntaxStyle={syntaxStyle}
            />
          </box>
        ) : (
          <LoadingState color={theme.textMuted} />
        )
      ) : null}
    </box>
  );
});

export type { DiffPaneProps } from "./types";
