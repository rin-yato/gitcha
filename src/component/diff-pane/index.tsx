import { pathToFiletype } from "@opentui/core";

import { createMemo, createResource, Show } from "solid-js";

import { $git } from "@/store/git.store";
import { $sidebar } from "@/store/sidebar.store";
import { $theme } from "@/store/theme.store";

import { git } from "@/lib/git";

import { collectSidebarFiles } from "@/component/sidebar/utils";

import { Result } from "better-result";

export function DiffPane() {
  const selectedFile = createMemo(() => {
    const files = collectSidebarFiles($git.status);
    return files.find((file) => file.path === $sidebar.selectedPath) ?? null;
  });

  const [diffResource] = createResource(selectedFile, async (file) => {
    if (!file) throw new Error("No file selected");
    return git.getUnifiedDiff(file).then(Result.unwrap);
  });

  return (
    <box backgroundColor={$theme.token.bg} width="100%" flexDirection="column">
      <box border={["bottom"]} borderColor={`${$theme.token.border}46`} borderStyle="heavy">
        <text fg={$theme.token.fg}>{selectedFile()?.path}</text>
      </box>

      <Show when={diffResource.error}>
        <text fg="red">Error: {String(diffResource.error)}</text>
      </Show>

      <Show when={diffResource()}>
        {(diff) => (
          <scrollbox>
            <diff
              diff={diff()}
              filetype={pathToFiletype(selectedFile()?.path ?? "")}
              syntaxStyle={$theme.syntax}
              fg={$theme.token.fg}
              selectionBg={`${$theme.token.accent}16`}
              addedBg={`${$theme.token.added}12`}
              removedBg={`${$theme.token.removed}12`}
              contextBg={$theme.token.bg}
              lineNumberFg={$theme.token.fgMuted}
              addedContentBg={`${$theme.token.added}12`}
              removedContentBg={`${$theme.token.removed}12`}
              contextContentBg={$theme.token.bg}
              addedSignColor={$theme.token.added}
              removedSignColor={$theme.token.removed}
              addedLineNumberBg={`${$theme.token.added}16`}
              removedLineNumberBg={`${$theme.token.removed}16`}
            />
          </scrollbox>
        )}
      </Show>
    </box>
  );
}
