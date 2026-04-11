import type { ScrollBoxRenderable } from "@opentui/core";

import { useEffect, useMemo, useRef, useState } from "react";

import type { DiffViewMode } from "../context/changes/state";
import { useReviewState } from "../context/changes/state";
import type { Theme } from "../context/theme/provider";
import { createSyntaxStyle, detectFiletype, treeSitterClient } from "../context/theme/syntax";
import { computeScrollbarMarkers, parseDiffPositions } from "../git/diff";

type FileDiffViewProps = {
  fileKey: string;
  diffContent: string;
  viewMode: DiffViewMode;
  theme: Theme;
  filetype: string;
  syntaxStyle: ReturnType<typeof createSyntaxStyle>;
};

type ScrollableRenderable = {
  scrollY: number;
};

type DiffRenderableLike = {
  scrollY?: number;
  findDescendantById?: (id: string) => ScrollableRenderable | undefined;
};

const SCROLLBAR_WIDTH = 1;

function DiffRenderablePane(props: FileDiffViewProps) {
  const app = useReviewState();
  const diffRenderableRef = useRef<DiffRenderableLike | null>(null);
  const scrollboxRef = useRef<ScrollBoxRenderable | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(30);
  const [scrollHeight, setScrollHeight] = useState(30);

  const getScrollTargetRaw = () => {
    const diffRenderable = diffRenderableRef.current;
    if (!diffRenderable) return null;

    if (typeof diffRenderable.scrollY === "number") {
      return diffRenderable;
    }

    return (
      diffRenderable.findDescendantById?.(`${props.fileKey}-left-code`) ??
      diffRenderable.findDescendantById?.(`${props.fileKey}-right-code`) ??
      null
    );
  };

  const getScrollTarget = () => getScrollTargetRaw();

  const changeInfo = useMemo(() => {
    if (!props.diffContent) return null;
    return parseDiffPositions(props.diffContent);
  }, [props.diffContent]);

  const markers = useMemo(() => {
    if (!changeInfo) return [];
    return computeScrollbarMarkers(changeInfo, scrollHeight);
  }, [changeInfo, scrollHeight]);

  const thumbHeight = useMemo(() => {
    if (scrollHeight === 0) return viewportHeight;
    const ratio = viewportHeight / scrollHeight;
    return Math.max(1, Math.round(ratio * viewportHeight));
  }, [viewportHeight, scrollHeight]);

  const thumbTop = useMemo(() => {
    if (scrollHeight <= viewportHeight) return 0;
    const maxScroll = scrollHeight - viewportHeight;
    const ratio = scrollTop / maxScroll;
    return Math.round(ratio * (viewportHeight - thumbHeight));
  }, [scrollTop, scrollHeight, viewportHeight, thumbHeight]);

  useEffect(() => {
    const target = getScrollTarget();
    if (target) {
      target.scrollY = app.getScrollPosition(props.fileKey);
    }
  }, [app, props.fileKey, props.diffContent]);

  useEffect(() => {
    if (!scrollboxRef.current) return;
    setScrollHeight(scrollboxRef.current.scrollHeight);
    const viewportBox = scrollboxRef.current.viewport;
    if (viewportBox) {
      const height = viewportBox.height;
      if (typeof height === "number" && height > 0) {
        setViewportHeight(height);
      }
    }
  }, [props.diffContent]);

  return (
    <box flexGrow={1} flexDirection="row">
      <scrollbox
        ref={scrollboxRef}
        flexGrow={1}
        style={{
          rootOptions: {
            backgroundColor: props.theme.background,
          },
          viewportOptions: {
            backgroundColor: props.theme.background,
          },
          contentOptions: {
            backgroundColor: props.theme.background,
          },
          scrollbarOptions: {
            visible: false,
          },
        }}
        onMouseScroll={() => {
          if (!scrollboxRef.current) return;
          setScrollTop(scrollboxRef.current.scrollTop);
        }}
      >
        <diff
          key={props.fileKey}
          id={props.fileKey}
          syncScroll={true}
          ref={(el) => {
            diffRenderableRef.current = el as DiffRenderableLike | null;
          }}
          diff={props.diffContent}
          view={props.viewMode}
          filetype={props.filetype}
          syntaxStyle={props.syntaxStyle as never}
          treeSitterClient={treeSitterClient as never}
          showLineNumbers
          wrapMode="word"
          fg={props.theme.text}
          selectionBg={`${props.theme.accent}16`}
          addedBg={`${props.theme.added}12`}
          removedBg={`${props.theme.removed}12`}
          contextBg={props.theme.background}
          lineNumberFg={props.theme.textMuted}
          lineNumberBg={props.theme.surface}
          addedContentBg={`${props.theme.added}12`}
          removedContentBg={`${props.theme.removed}12`}
          contextContentBg={props.theme.background}
          addedSignColor={props.theme.added}
          removedSignColor={props.theme.removed}
          addedLineNumberBg={`${props.theme.added}16`}
          removedLineNumberBg={`${props.theme.removed}16`}
        />
      </scrollbox>
      <box
        width={SCROLLBAR_WIDTH}
        backgroundColor={`${props.theme.surface}40`}
        position="relative"
      >
        <box
          position="absolute"
          top={thumbTop}
          width={SCROLLBAR_WIDTH}
          height={thumbHeight}
          backgroundColor={`${props.theme.textMuted}80`}
        />

        {markers.map((marker, i) => (
          <text
            key={i}
            content="▎"
            fg={marker.type === "addition" ? props.theme.added : props.theme.removed}
            position="absolute"
            top={`${marker.position * 100}%`}
          />
        ))}
      </box>
    </box>
  );
}

export function DiffPane(props: {
  theme: Theme;
  selectedFile: string | null;
  selectedFileKey: string | null;
  diffContent: string | null;
  diffViewMode: DiffViewMode;
  toggleDiffViewMode: () => void;
}) {
  const filetype = useMemo(() => detectFiletype(props.selectedFile), [props.selectedFile]);
  const syntaxStyle = useMemo(() => createSyntaxStyle(props.theme), [props.theme]);

  return (
    <box
      id="code-panel"
      backgroundColor={props.theme.background}
      flexGrow={1}
      flexDirection="column"
    >
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <text
          content={props.selectedFile || "no file selected"}
          fg={props.theme.text}
          attributes={1}
          selectable={false}
        />
        <text content={props.diffViewMode} fg={props.theme.textMuted} selectable={false} />
      </box>

      {props.selectedFileKey ? (
        props.selectedFile && props.diffContent ? (
          <box flexGrow={1} flexDirection="column">
            <DiffRenderablePane
              fileKey={props.selectedFileKey}
              diffContent={props.diffContent}
              viewMode={props.diffViewMode}
              theme={props.theme}
              filetype={filetype ?? "text"}
              syntaxStyle={syntaxStyle}
            />
          </box>
        ) : (
          <text content="Loading..." fg={props.theme.textMuted} selectable={false} />
        )
      ) : null}
    </box>
  );
}
