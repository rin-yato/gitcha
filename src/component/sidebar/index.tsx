import { useBindings } from "@opentui/keymap/solid";

import { createMemo, For, onCleanup, onMount, Show } from "solid-js";

import { StatusSection } from "./status-section";
import {
  collectReviewFiles,
  collectSidebarFiles,
  createReviewSectionViews,
  createSidebarSectionViews,
} from "./utils";
import { useDialog } from "@/context/dialog";
import { useExCommand } from "@/context/ex-command";
import { useGit } from "@/context/git";
import { useReview } from "@/context/review";
import { useSidebar } from "@/context/sidebar";
import { useTheme } from "@/context/theme";

export function Sidebar() {
  const review = useReview();
  const dialog = useDialog();
  const exCommand = useExCommand();
  const sidebar = useSidebar();
  const gitStore = useGit();
  const theme = useTheme();

  // Simple git polling
  onMount(() => {
    const interval = setInterval(() => {
      if (!review.state.active) void gitStore.refresh();
    }, 1000);

    void gitStore.refresh();

    onCleanup(() => {
      clearInterval(interval);
    });
  });

  const allSidebarFiles = createMemo(() =>
    review.state.active
      ? collectReviewFiles(review.state.status?.files ?? null, sidebar.state.viewMode)
      : collectSidebarFiles(gitStore.state.status, sidebar.state.viewMode),
  );
  const sidebarTargets = createMemo(() => allSidebarFiles().map((entry) => entry.target));
  const sections = createMemo(() =>
    review.state.active
      ? createReviewSectionViews(
          review.state.status?.files ?? null,
          sidebar.state.viewMode,
          sidebar.state.collapsedDirectoryKeys,
        )
      : createSidebarSectionViews(
          gitStore.state.status,
          sidebar.state.viewMode,
          sidebar.state.collapsedDirectoryKeys,
        ),
  );

  useBindings(() => ({
    enabled: () => dialog.state.stack.length === 0 && !exCommand.state.visible,
    commands: [
      {
        name: "sidebar.select-next",
        run() {
          sidebar.selectNext(sidebarTargets());
        },
      },
      {
        name: "sidebar.select-prev",
        run() {
          sidebar.selectPrevious(sidebarTargets());
        },
      },
      {
        name: "sidebar.width.increase",
        run() {
          sidebar.increaseWidth();
        },
      },
      {
        name: "sidebar.width.decrease",
        run() {
          sidebar.decreaseWidth();
        },
      },
      {
        name: "sidebar.toggle",
        run() {
          sidebar.toggle();
        },
      },
      {
        name: "review.exit",
        run() {
          if (review.state.active) review.stop();
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
    <Show when={sidebar.state.open}>
      <box
        backgroundColor={theme.state.token.bg}
        width={sidebar.state.width}
        flexDirection="column"
        overflow="hidden"
        paddingRight={1}
      >
        <box
          border={["bottom"]}
          borderColor={`${theme.state.token.border}66`}
          borderStyle="heavy"
          flexShrink={0}
          paddingLeft={1}
        >
          <text fg={theme.state.token.fg} attributes={1}>
            {review.state.active
              ? `Review: ${review.state.status?.resolution.baseLabel ?? "..."}`
              : "Gitcha"}
          </text>
        </box>

        <scrollbox
          backgroundColor={theme.state.token.surface}
          width={sidebar.state.width}
          flexDirection="column"
          contentOptions={{ gap: 1 }}
          scrollX={false}
          scrollY={true}
          flexGrow={1}
          flexShrink={0}
        >
          <Show when={review.state.active ? review.state.error : gitStore.state.error}>
            <text fg="red">
              {review.state.active ? review.state.error : gitStore.state.error}
            </text>
          </Show>

          <For each={sections()}>
            {(section) => (
              <StatusSection
                section={{ ...section, selectedTarget: sidebar.state.selectedTarget }}
              />
            )}
          </For>
        </scrollbox>
      </box>
    </Show>
  );
}
