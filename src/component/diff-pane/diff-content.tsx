import { memo, useRef } from "react";

import type { DiffContentProps, DiffRenderableRef } from "./types";

export const DiffContent = memo(function DiffContent(props: DiffContentProps) {
  const diffRenderableRef = useRef<DiffRenderableRef>(null);

  return (
    <changes
      id={props.fileKey}
      syncScroll={true}
      ref={diffRenderableRef}
      onScrollStateChange={props.onScrollStateChange}
      diff={props.diffContent}
      view={props.viewMode}
      virtualizationOverscan={8}
      filetype={props.filetype}
      syntaxStyle={props.syntaxStyle as never}
      showLineNumbers
      wrapMode="word"
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
    />
  );
});
