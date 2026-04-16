import { memo, useCallback, useRef } from "react";

import { dequal } from "dequal";

import type { SlottableDiffRenderable } from "../slottable-diff";
import type { DiffContentProps } from "./types";

export const DiffContent = memo(function DiffContent(props: DiffContentProps) {
  const diffRenderableRef = useRef<SlottableDiffRenderable | null>(null);

  const handleSizeChange = useCallback(() => {
    if (!diffRenderableRef.current) return;
    props.onHeightChange(diffRenderableRef.current.height);
  }, [props.onHeightChange]);

  return (
    <slottable-diff
      width="100%"
      height="100%"
      virtualize
      syncScroll
      wrapMode="word"
      showLineNumbers
      ref={diffRenderableRef}
      onSizeChange={handleSizeChange}
      diff={props.diffContent}
      view={props.viewMode}
      filetype={props.filetype}
      syntaxStyle={props.syntaxStyle}
      fg={props.theme.text}
      selectionBg={`${props.theme.accent}16`}
      addedBg={`${props.theme.added}12`}
      removedBg={`${props.theme.removed}12`}
      contextBg={props.theme.background}
      lineNumberFg={props.theme.textMuted}
      addedContentBg={`${props.theme.added}12`}
      removedContentBg={`${props.theme.removed}12`}
      contextContentBg={props.theme.background}
      addedSignColor={props.theme.added}
      removedSignColor={props.theme.removed}
      addedLineNumberBg={`${props.theme.added}16`}
      removedLineNumberBg={`${props.theme.removed}16`}
      onScrollStateChange={props.onScrollStateChange}
    />
  );
}, dequal);
