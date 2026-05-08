import { pathToFiletype } from "@opentui/core";

import { type Accessor, createResource, Show } from "solid-js";

import { $theme } from "@/store/theme.store";

import { type GitStatusFile, git } from "@/lib/git";

import { Result } from "better-result";

interface DiffProps {
  selectedFile: Accessor<GitStatusFile>;
}

export function Diff(props: DiffProps) {
  const [diffResource] = createResource(props.selectedFile, async (file) => {
    return git.getUnifiedDiff(file).then(Result.unwrap);
  });

  return (
    <box backgroundColor={$theme.token.bg} width="100%" flexDirection="column">
      <box
        border={["bottom"]}
        borderColor={`${$theme.token.border}66`}
        borderStyle="heavy"
        flexShrink={0}
      >
        <text fg={$theme.token.fg}>{props.selectedFile().path}</text>
      </box>

      <Show when={diffResource.error}>
        <text fg="red">Error: {String(diffResource.error)}</text>
      </Show>

      <Show when={diffResource()}>
        {(diff) => (
          <diff
            width="100%"
            height="100%"
            diff={diff()}
            syncScroll
            filetype={pathToFiletype(props.selectedFile().path ?? "")}
            syntaxStyle={$theme.syntax}
            //
            //
            fg={$theme.token.fg}
            selectionBg={`${$theme.token.accent}16`}
            //
            //
            addedBg={`${$theme.token.added}12`}
            removedBg={`${$theme.token.removed}12`}
            addedContentBg={`${$theme.token.added}12`}
            removedContentBg={`${$theme.token.removed}12`}
            //
            //
            lineNumberFg={$theme.token.fgMuted}
            addedLineNumberBg={`${$theme.token.added}12`}
            removedLineNumberBg={`${$theme.token.removed}12`}
            //
            //
            contextBg={$theme.token.bg}
            contextContentBg={$theme.token.bg}
            //
            //
            addedSignColor={$theme.token.added}
            removedSignColor={$theme.token.removed}
          />
        )}
      </Show>
    </box>
  );
}
