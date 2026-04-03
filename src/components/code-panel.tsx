import { createMemo, onCleanup, onMount, Show } from "solid-js";

import type { DiffViewMode } from "../state";
import { createSyntaxStyle, detectFiletype, treeSitterClient } from "../styles/syntax";
import type { Theme } from "../styles/theme";

export function CodePanel(props: {
  theme: Theme;
  selectedFile: string | null;
  selectedFileKey: string | null;
  diffContent: string | null;
  diffViewMode: DiffViewMode;
  toggleDiffViewMode: () => void;
}) {
  const filetype = createMemo(() => detectFiletype(props.selectedFile));
  const syntaxStyle = createMemo(() => createSyntaxStyle(props.theme));
  const scrollPositions = new Map<string, number>();

  function FileDiffView(viewProps: {
    fileKey: string;
    diffContent: string;
    viewMode: DiffViewMode;
    theme: Theme;
    filetype: string;
    syntaxStyle: ReturnType<typeof createSyntaxStyle>;
  }) {
    let viewer: any = null;

    onMount(() => {
      viewer.scrollY = scrollPositions.get(viewProps.fileKey) ?? 0;
    });

    onCleanup(() => {
      if (viewer) {
        scrollPositions.set(viewProps.fileKey, viewer.scrollY ?? 0);
      }
    });

    return (
      <diff
        ref={(el: any) => {
          viewer = el;
        }}
        diff={viewProps.diffContent}
        view={viewProps.viewMode}
        filetype={viewProps.filetype}
        syntaxStyle={viewProps.syntaxStyle}
        treeSitterClient={treeSitterClient}
        showLineNumbers
        wrapMode="word"
        fg={viewProps.theme.text}
        selectionBg={`${viewProps.theme.accent}16`}
        addedBg={`${viewProps.theme.added}12`}
        removedBg={`${viewProps.theme.removed}12`}
        contextBg={viewProps.theme.background}
        lineNumberFg={viewProps.theme.textMuted}
        lineNumberBg={viewProps.theme.surface}
        addedContentBg={`${viewProps.theme.added}12`}
        removedContentBg={`${viewProps.theme.removed}12`}
        contextContentBg={viewProps.theme.background}
        addedSignColor={viewProps.theme.added}
        removedSignColor={viewProps.theme.removed}
        addedLineNumberBg={`${viewProps.theme.added}16`}
        removedLineNumberBg={`${viewProps.theme.removed}16`}
      />
    );
  }

  return (
    <box
      id="code-panel"
      backgroundColor={props.theme.background}
      flexGrow={1}
      flexDirection="column"
    >
      <box flexDirection="row" justifyContent="space-between" paddingBottom={1}>
        <text fg={props.theme.text} attributes={1} selectable={false}>
          {props.selectedFile || "no file selected"}
        </text>
        <text fg={props.theme.textMuted} selectable={false}>
          {props.diffViewMode}
        </text>
      </box>

      <Show when={props.selectedFileKey} keyed>
        {(fileKey: string) =>
          props.selectedFile && props.diffContent ? (
            <box flexGrow={1} flexDirection="column">
              <FileDiffView
                fileKey={fileKey}
                diffContent={props.diffContent}
                viewMode={props.diffViewMode}
                theme={props.theme}
                filetype={filetype() ?? "text"}
                syntaxStyle={syntaxStyle()}
              />
            </box>
          ) : (
            <text content="Loading..." fg={props.theme.textMuted} selectable={false} />
          )
        }
      </Show>
    </box>
  );
}
