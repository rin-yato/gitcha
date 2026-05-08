import { useKeyboard } from "@opentui/solid";

import { createEffect, createMemo, For, onCleanup, onMount, Show } from "solid-js";

import { $git } from "@/store/git.store";
import { $sidebar } from "@/store/sidebar.store";
import { $theme } from "@/store/theme.store";

import { isGitFileTargetEqual } from "@/lib/git";

import { StatusSection } from "./status-section";
import { collectSidebarFiles, createSidebarSections } from "./utils";

export function Sidebar() {
  // Simple git polling
  onMount(() => {
    const interval = setInterval(() => {
      void $git.action.refresh();
    }, 1000);

    void $git.action.refresh();

    onCleanup(() => {
      clearInterval(interval);
    });
  });

  const sidebarFiles = createMemo(() => collectSidebarFiles($git.status));
  const sidebarTargets = createMemo(() => sidebarFiles().map((entry) => entry.target));
  const sections = createMemo(() => createSidebarSections($git.status));

  useKeyboard((key) => {
    const files = sidebarTargets();

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

  const hasChanges = createMemo(() => sidebarTargets().length > 0);

  createEffect(() => {
    const files = sidebarTargets();

    if (files.length === 0) {
      if ($sidebar.selectedTarget !== null) {
        $sidebar.action.setSelectedTarget(null);
      }
      return;
    }

    if (!files.some((file) => isGitFileTargetEqual(file, $sidebar.selectedTarget))) {
      $sidebar.action.setSelectedTarget(files[0] ?? null);
    }
  });

  return (
    <Show when={$sidebar.open && hasChanges()}>
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
          <Show when={$git.error}>
            <text fg="red">{$git.error}</text>
          </Show>

          <For each={sections()}>
            {(section) => (
              <StatusSection
                section={{ ...section, selectedTarget: $sidebar.selectedTarget }}
              />
            )}
          </For>
        </scrollbox>
      </box>
    </Show>
  );
}
