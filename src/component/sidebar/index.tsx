import { useKeyboard } from "@opentui/solid";

import { createEffect, createMemo, onMount, Show } from "solid-js";

import { $git } from "@/store/git.store";
import { $sidebar } from "@/store/sidebar.store";
import { $theme } from "@/store/theme.store";

import { StatusSection } from "./status-section";
import { collectSidebarFiles } from "./utils";

export function Sidebar() {
  onMount(() => {
    void $git.action.refresh();
  });

  useKeyboard((key) => {
    const files = changesFiles();

    if (key.name === "down" || key.name === "j") {
      return $sidebar.action.selectNext(files);
    }

    if (key.name === "up" || key.name === "k") {
      return $sidebar.action.selectPrevious(files);
    }

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

  const changesFiles = createMemo(() => collectSidebarFiles($git.status));

  createEffect(() => {
    const files = changesFiles();

    if (files.length === 0) {
      if ($sidebar.selectedPath !== null) {
        $sidebar.action.setSelectedPath(null);
      }
      return;
    }

    if (!files.some((file) => file.path === $sidebar.selectedPath)) {
      $sidebar.action.setSelectedPath(files[0]?.path ?? null);
    }
  });

  return (
    <Show when={$sidebar.open}>
      <box
        backgroundColor={$theme.token.bg}
        width={$sidebar.width}
        flexDirection="column"
        overflow="hidden"
        paddingRight={1}
      >
        <box
          border={["bottom"]}
          borderColor={`${$theme.token.border}66`}
          borderStyle="heavy"
          flexShrink={0}
          paddingLeft={1}
        >
          <text fg={$theme.token.fg} attributes={1}>
            Gitcha
          </text>
        </box>

        <scrollbox
          backgroundColor={$theme.token.surface}
          width={$sidebar.width}
          flexDirection="column"
          contentOptions={{ gap: 1 }}
          scrollX={false}
          scrollY={true}
          flexGrow={1}
          flexShrink={0}
        >
          <Show when={$git.loading}>
            <text fg="gray">Loading...</text>
          </Show>

          <Show when={$git.error}>
            <text fg="red">{$git.error}</text>
          </Show>

          <StatusSection
            section={{ ...changes().conflicts, selectedPath: $sidebar.selectedPath }}
          />
          <StatusSection
            section={{ ...changes().staged, selectedPath: $sidebar.selectedPath }}
          />
          <StatusSection
            section={{ ...changes().changes, selectedPath: $sidebar.selectedPath }}
          />
        </scrollbox>
      </box>
    </Show>
  );
}
