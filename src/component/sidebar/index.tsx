import { useKeyboard } from "@opentui/solid";

import { createMemo, onMount, Show } from "solid-js";

import { $git } from "@/store/git.store";
import { $sidebar } from "@/store/sidebar.store";
import { $theme } from "@/store/theme.store";

import { StatusSection } from "./status-section";

export function Sidebar() {
  onMount(() => {
    void $git.action.refresh();
  });

  useKeyboard((key) => {
    if (key.name === "]") {
      return $sidebar.action.increaseWidth();
    }

    if (key.name === "[") {
      return $sidebar.action.decreaseWidth();
    }

    if (key.name === "\\") {
      return $sidebar.action.toggle();
    }
  });

  const changes = createMemo(() => {
    const conflictedFiles = $git.status?.files.conflicted || [];
    const stagedFiles = $git.status?.files.staged || [];
    const changedFiles = $git.status?.files.changes.concat($git.status.files.untracked) || [];

    return {
      conflicts: {
        title: "Conflicts",
        kind: "conflicts",
        files: conflictedFiles,
        count: conflictedFiles.length,
      },
      staged: {
        title: "Staged",
        kind: "staged",
        files: stagedFiles,
        count: stagedFiles.length,
      },
      changes: {
        title: "Changes",
        kind: "changes",
        files: changedFiles,
        count: changedFiles.length,
      },
    } satisfies Record<string, StatusSection>;
  });

  return (
    <Show when={$sidebar.open}>
      <scrollbox
        backgroundColor={$theme.token.surface}
        width={$sidebar.width}
        flexDirection="column"
        contentOptions={{ gap: 1 }}
      >
        <Show when={$git.loading}>
          <text fg="gray">Loading...</text>
        </Show>

        <Show when={$git.error}>
          <text fg="red">{$git.error}</text>
        </Show>

        <StatusSection section={changes().conflicts} />
        <StatusSection section={changes().staged} />
        <StatusSection section={changes().changes} />
      </scrollbox>
    </Show>
  );
}
