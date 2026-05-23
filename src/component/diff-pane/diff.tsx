import { pathToFiletype } from "@opentui/core";

import { $theme } from "@/store/theme.store";

interface DiffProps {
  filePath: string;
  diff: string;
}

export function Diff(props: DiffProps) {
  return (
    <box backgroundColor={$theme.token.bg} width="100%" flexDirection="column">
      <box
        border={["bottom"]}
        borderColor={`${$theme.token.border}66`}
        borderStyle="heavy"
        flexShrink={0}
      >
        <text fg={$theme.token.fg}>{props.filePath}</text>
      </box>

      <diff
        width="100%"
        height="100%"
        diff={props.diff}
        syncScroll
        filetype={pathToFiletype(props.filePath ?? "")}
        syntaxStyle={$theme.syntax}
        fg={$theme.token.fg}
        selectionBg={`${$theme.token.accent}16`}
        addedBg={`${$theme.token.added}12`}
        removedBg={`${$theme.token.removed}12`}
        addedContentBg={`${$theme.token.added}12`}
        removedContentBg={`${$theme.token.removed}12`}
        lineNumberFg={$theme.token.fgMuted}
        addedLineNumberBg={`${$theme.token.added}12`}
        removedLineNumberBg={`${$theme.token.removed}12`}
        contextBg={$theme.token.bg}
        contextContentBg={$theme.token.bg}
        addedSignColor={$theme.token.added}
        removedSignColor={$theme.token.removed}
      />
    </box>
  );
}
