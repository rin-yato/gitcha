import { pathToFiletype } from "@opentui/core";

import { useTheme } from "@/context/theme";

interface DiffProps {
  filePath: string;
  diff: string;
}

export function Diff(props: DiffProps) {
  const theme = useTheme();

  return (
    <box backgroundColor={theme.state.token.bg} width="100%" flexDirection="column">
      <box
        border={["bottom"]}
        borderColor={`${theme.state.token.border}66`}
        borderStyle="heavy"
        flexShrink={0}
      >
        <text fg={theme.state.token.fg}>{props.filePath}</text>
      </box>

      <diff
        width="100%"
        height="100%"
        diff={props.diff}
        syncScroll
        filetype={pathToFiletype(props.filePath ?? "")}
        syntaxStyle={theme.state.syntax}
        fg={theme.state.token.fg}
        selectionBg={`${theme.state.token.accent}16`}
        addedBg={`${theme.state.token.added}12`}
        removedBg={`${theme.state.token.removed}12`}
        addedContentBg={`${theme.state.token.added}12`}
        removedContentBg={`${theme.state.token.removed}12`}
        lineNumberFg={theme.state.token.fgMuted}
        addedLineNumberBg={`${theme.state.token.added}12`}
        removedLineNumberBg={`${theme.state.token.removed}12`}
        contextBg={theme.state.token.bg}
        contextContentBg={theme.state.token.bg}
        addedSignColor={theme.state.token.added}
        removedSignColor={theme.state.token.removed}
      />
    </box>
  );
}
