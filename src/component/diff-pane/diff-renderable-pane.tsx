import type { ScrollBoxRenderable } from "@opentui/core";

import { memo, useCallback, useMemo, useRef, useState } from "react";

import { DiffContent } from "./diff-content";
import { Scrollbar } from "./scrollbar";
import type { DiffRenderablePaneProps } from "./types";
import { computeScrollbarMetrics, useScrollbarMarkers } from "./utils";

export const DiffRenderablePane = memo(function DiffRenderablePane(
  props: DiffRenderablePaneProps,
) {
  const scrollboxRef = useRef<ScrollBoxRenderable | null>(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);

  const markers = useScrollbarMarkers(props.diffContent);

  const scrollbarMetrics = useMemo(
    () => computeScrollbarMetrics(viewportHeight, scrollHeight, scrollTop),
    [viewportHeight, scrollHeight, scrollTop],
  );

  const handleHeightChange = useCallback((height: number) => {
    setScrollHeight(height);
  }, []);

  const handleMouseScroll = useCallback(() => {
    if (!scrollboxRef.current) return;
    setScrollTop(scrollboxRef.current.scrollTop);
  }, []);

  const handleSizeChange = useCallback(() => {
    if (!scrollboxRef.current) return;
    setViewportHeight(scrollboxRef.current.height);
  }, []);

  const { thumbHeight, thumbTop, showScrollbar } = scrollbarMetrics;
  const { theme, fileKey, diffContent, viewMode, filetype, syntaxStyle } = props;

  return (
    <box flexGrow={1} flexDirection="row" overflow="hidden">
      <scrollbox
        viewportCulling
        ref={scrollboxRef}
        style={{
          scrollbarOptions: {
            visible: false,
          },
        }}
        onMouseScroll={handleMouseScroll}
        onSizeChange={handleSizeChange}
      >
        <DiffContent
          fileKey={fileKey}
          diffContent={diffContent}
          viewMode={viewMode}
          theme={theme}
          filetype={filetype}
          syntaxStyle={syntaxStyle}
          onHeightChange={handleHeightChange}
        />
      </scrollbox>

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
