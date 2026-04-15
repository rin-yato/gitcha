import type { DiffRenderable, ScrollBoxRenderable } from "@opentui/core";

import { useMemo, useRef, useState } from "react";

import type { DiffViewMode } from "@/context/diff";
import { createSyntaxStyle, detectFiletype, type Theme } from "@/context/theme";

import type { GitStatusFile } from "@/lib/git";
import { computeScrollbarMarkers, parseDiffPositions } from "@/lib/git";

type FileDiffViewProps = {
  fileKey: string;
  diffContent: string;
  viewMode: DiffViewMode;
  theme: Theme;
  filetype: string;
  syntaxStyle: ReturnType<typeof createSyntaxStyle>;
};

const SCROLLBAR_WIDTH = 1;

function DiffRenderablePane(props: FileDiffViewProps) {
  const diffRenderableRef = useRef<DiffRenderable | null>(null);
  const scrollboxRef = useRef<ScrollBoxRenderable | null>(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);
  const [scrollHeight, setScrollHeight] = useState(0);

  const changeInfo = useMemo(() => {
    if (!props.diffContent) return null;
    return parseDiffPositions(props.diffContent);
  }, [props.diffContent]);

  const markers = useMemo(() => {
    if (!changeInfo) return [];
    return computeScrollbarMarkers(changeInfo, changeInfo.totalUnifiedLines);
  }, [changeInfo]);

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

  const showScrollbar = viewportHeight > 0 && scrollHeight > viewportHeight;

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
        onMouseScroll={() => {
          if (!scrollboxRef.current) return;
          setScrollTop(scrollboxRef.current.scrollTop);
        }}
        onSizeChange={() => {
          if (!scrollboxRef.current) return;
          setViewportHeight(scrollboxRef.current.height);
        }}
      >
        <diff
          id={props.fileKey}
          key={props.fileKey}
          syncScroll={true}
          ref={diffRenderableRef}
          onSizeChange={() => {
            if (!diffRenderableRef.current) return;
            setScrollHeight(diffRenderableRef.current.height);
          }}
          diff={props.diffContent}
          view={props.viewMode}
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
      </scrollbox>

      {showScrollbar ? (
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
      ) : null}
    </box>
  );
}

export function DiffPane(props: {
  theme: Theme;
  selectedFile: string | null;
  selectedFileKey: string | null;
  selectedFileInfo: GitStatusFile | null;
  diffContent: string | null;
  diffViewMode: DiffViewMode;
  toggleDiffViewMode: () => void;
}) {
  const filetype = useMemo(() => detectFiletype(props.selectedFile), [props.selectedFile]);
  const syntaxStyle = useMemo(() => createSyntaxStyle(props.theme), [props.theme]);
  const headerLabel = props.selectedFileInfo?.originalPath
    ? `${props.selectedFile ?? "no file selected"} · Renamed from ${props.selectedFileInfo.originalPath}`
    : props.selectedFile || "no file selected";

  return (
    <box
      id="code-panel"
      backgroundColor={props.theme.background}
      flexGrow={1}
      flexDirection="column"
    >
      <box
        flexDirection="row"
        justifyContent="space-between"
        paddingBottom={1}
        paddingX={1}
        overflow="hidden"
      >
        <text
          content={headerLabel}
          fg={props.theme.text}
          attributes={1}
          selectable={false}
          flexGrow={1}
          flexShrink={1}
          minWidth={0}
          truncate
        />
        <text
          content={props.diffViewMode}
          fg={props.theme.textMuted}
          selectable={false}
          flexShrink={0}
        />
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
