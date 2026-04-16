import { memo, useCallback, useMemo, useState } from "react";

import { DiffContent } from "./diff-content";
import { Scrollbar } from "./scrollbar";
import type { DiffRenderablePaneProps } from "./types";
import { computeScrollbarMetrics, useScrollbarMarkers } from "./utils";

export const DiffRenderablePane = memo(function DiffRenderablePane(
  props: DiffRenderablePaneProps,
) {
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);

  const markers = useScrollbarMarkers(props.diffContent);

  const scrollbarMetrics = useMemo(
    () => computeScrollbarMetrics(viewportHeight, scrollHeight, scrollTop),
    [viewportHeight, scrollHeight, scrollTop],
  );

  const _handleHeightChange = useCallback((height: number) => {
    setScrollHeight(height);
  }, []);

  const handleScrollStateChange = useCallback(
    (state: { scrollTop: number; viewportHeight: number; scrollHeight: number }) => {
      setScrollTop(state.scrollTop);
      setViewportHeight(state.viewportHeight);
      setScrollHeight(state.scrollHeight);
    },
    [],
  );

  const handleContentHeightChange = useCallback((height: number) => {
    setScrollHeight(height);
  }, []);

  const { thumbHeight, thumbTop, showScrollbar } = scrollbarMetrics;
  const { theme, fileKey, diffContent, viewMode, filetype, syntaxStyle } = props;

  return (
    <box flexGrow={1} flexDirection="row" overflow="hidden">
      <DiffContent
        fileKey={fileKey}
        diffContent={diffContent}
        viewMode={viewMode}
        theme={theme}
        filetype={filetype}
        syntaxStyle={syntaxStyle}
        onHeightChange={handleContentHeightChange}
        onScrollStateChange={handleScrollStateChange}
      />

      {showScrollbar && (
        <Scrollbar
          thumbTop={thumbTop}
          thumbHeight={thumbHeight}
          surfaceColor={`${theme.surface}40`}
          thumbColor={`${theme.textMuted}80`}
          markers={markers}
          addedColor={theme.added}
          removedColor={theme.removed}
        />
      )}
    </box>
  );
});
