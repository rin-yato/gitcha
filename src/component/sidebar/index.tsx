import type { ScrollBoxRenderable } from "@opentui/core";
import { useBindings } from "@opentui/keymap/solid";

import { createEffect, For, onCleanup, onMount, Show } from "solid-js";

import { StatusSection } from "./status-section";
import { useDialog } from "@/context/dialog";
import { useExCommand } from "@/context/ex-command";
import { useGit } from "@/context/git";
import { useReview } from "@/context/review";
import { useSidebar } from "@/context/sidebar";
import { createSidebarFileId } from "@/context/sidebar/sidebar-key";
import { useTheme } from "@/context/theme";

export function Sidebar() {
  const review = useReview();
  const dialog = useDialog();
  const exCommand = useExCommand();
  const sidebar = useSidebar();
  const gitStore = useGit();
  const theme = useTheme();

  let scroll: ScrollBoxRenderable | undefined;

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

  useBindings(() => ({
    enabled: () => dialog.state.stack.length === 0 && !exCommand.state.visible,
    commands: [
      {
        name: "sidebar.select-next",
        run() {
          sidebar.selectNext();
        },
      },
      {
        name: "sidebar.select-prev",
        run() {
          sidebar.selectPrevious();
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

  createEffect(() => {
    const target = sidebar.state.selectedTarget;
    if (!target || !scroll) return;

    const id = createSidebarFileId(target.section, target.path);
    const child = scroll.findDescendantById(id);
    if (!child) return;

    const y = child.y - scroll.y;
    const centerOffset = Math.floor(scroll.height / 2);
    scroll.scrollBy(y - centerOffset);
  });

  return (
    <Show when={sidebar.state.open}>
      <box
        backgroundColor={theme.state.token.bg}
        height="100%"
        width={sidebar.state.width}
        flexDirection="column"
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

        <box>
          <scrollbox
            scrollY
            viewportCulling
            ref={scroll}
            backgroundColor={theme.state.token.surface}
            width={sidebar.state.width}
            style={{
              height: "100%",
              flexGrow: 1,
              contentOptions: { gap: 1 },
              scrollbarOptions: { visible: false },
            }}
          >
            <Show when={review.state.active ? review.state.error : gitStore.state.error}>
              <text fg="red">
                {review.state.active ? review.state.error : gitStore.state.error}
              </text>
            </Show>

            <For each={sidebar.sections()}>
              {(section) => (
                <StatusSection
                  section={{ ...section, selectedTarget: sidebar.state.selectedTarget }}
                />
              )}
            </For>
          </scrollbox>
        </box>
      </box>
    </Show>
  );
}
