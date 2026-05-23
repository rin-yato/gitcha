import { useBindings } from "@opentui/keymap/solid";

import { createMemo, For, onCleanup, onMount, Show } from "solid-js";

import { $dialog } from "@/store/dialog.store";
import { $exCommand } from "@/store/ex-command.store";
import { $git } from "@/store/git.store";
import { $review } from "@/store/review.store";
import { $sidebar } from "@/store/sidebar";
import { $theme } from "@/store/theme.store";

import { StatusSection } from "./status-section";
import {
  collectReviewFiles,
  collectSidebarFiles,
  createReviewSectionViews,
  createSidebarSectionViews,
} from "./utils";

export function Sidebar() {
  // Simple git polling
  onMount(() => {
    const interval = setInterval(() => {
      if (!$review.active) void $git.action.refresh();
    }, 1000);

    void $git.action.refresh();

    onCleanup(() => {
      clearInterval(interval);
    });
  });

  const allSidebarFiles = createMemo(() =>
    $review.active
      ? collectReviewFiles($review.status?.files ?? null, $sidebar.viewMode)
      : collectSidebarFiles($git.status, $sidebar.viewMode),
  );
  const sidebarTargets = createMemo(() => allSidebarFiles().map((entry) => entry.target));
  const sections = createMemo(() =>
    $review.active
      ? createReviewSectionViews(
          $review.status?.files ?? null,
          $sidebar.viewMode,
          $sidebar.collapsedDirectoryKeys,
        )
      : createSidebarSectionViews(
          $git.status,
          $sidebar.viewMode,
          $sidebar.collapsedDirectoryKeys,
        ),
  );

  useBindings(() => ({
    enabled: () => $dialog.stack.length === 0 && !$exCommand.visible,
    commands: [
      {
        name: "sidebar.select-next",
        run() {
          $sidebar.action.selectNext(sidebarTargets());
        },
      },
      {
        name: "sidebar.select-prev",
        run() {
          $sidebar.action.selectPrevious(sidebarTargets());
        },
      },
      {
        name: "sidebar.width.increase",
        run() {
          $sidebar.action.increaseWidth();
        },
      },
      {
        name: "sidebar.width.decrease",
        run() {
          $sidebar.action.decreaseWidth();
        },
      },
      {
        name: "sidebar.toggle",
        run() {
          $sidebar.action.toggle();
        },
      },
      {
        name: "review.exit",
        run() {
          if ($review.active) $review.action.stop();
        },
      },
    ],

    bindings: [
      { key: "down", cmd: "sidebar.select-next", desc: "Next file" },
      { key: "j", cmd: "sidebar.select-next", desc: "Next file" },
      { key: "up", cmd: "sidebar.select-prev", desc: "Previous file" },
      { key: "k", cmd: "sidebar.select-prev", desc: "Previous file" },
      { key: "]", cmd: "sidebar.width.increase", desc: "Widen sidebar" },
      { key: "[", cmd: "sidebar.width.decrease", desc: "Shrink sidebar" },
      { key: "\\", cmd: "sidebar.toggle", desc: "Toggle sidebar" },
      { key: "escape", cmd: "review.exit", desc: "Exit review" },
    ],
  }));

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
            {$review.active
              ? `Review: ${$review.status?.resolution.baseLabel ?? "..."}`
              : "Gitcha"}
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
          <Show when={$review.active ? $review.error : $git.error}>
            <text fg="red">{$review.active ? $review.error : $git.error}</text>
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
