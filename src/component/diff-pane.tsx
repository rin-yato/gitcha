import { useEffect, useMemo, useRef } from "react";

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

function DiffRenderablePane(props: FileDiffViewProps) {
  const app = useReviewState();
  const diffRenderableRef = useRef<DiffRenderableLike | null>(null);

  const markers = useMemo(() => {
    if (!props.diffContent) return [];
    const changeMap = parseDiffPositions(props.diffContent);
    return computeScrollbarMarkers(changeMap);
  }, [props.diffContent]);

  const getScrollTarget = () => {
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

  useEffect(() => {
    const target = getScrollTarget();
    if (target) {
      target.scrollY = app.getScrollPosition(props.fileKey);
    }

    return () => {
      const currentTarget = getScrollTarget();
      if (currentTarget) {
        app.setScrollPosition(props.fileKey, currentTarget.scrollY ?? 0);
      }
    };
  }, [app, props.fileKey, props.diffContent]);

  return (
    <box flexGrow={1} flexDirection="row">
      <scrollbox
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
            width: 1,
            trackOptions: {
              foregroundColor: props.theme.textMuted,
              backgroundColor: `${props.theme.surface}40`,
            },
          },
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
      <box width={1} backgroundColor={`${props.theme.surface}40`}>
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
