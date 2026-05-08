import { mergeProps } from "solid-js";
import { createStore, produce } from "solid-js/store";

import { $config } from "@/store/config.store";

import type { GitFileTarget } from "@/lib/git";
import { isGitFileTargetEqual } from "@/lib/git";

type SidebarState = {
  width: number;
  open: boolean;
  selectedTarget: GitFileTarget | null;
};

const [sidebarState, setSidebarState] = createStore<SidebarState>({
  width: $config.sidebar.defaultWidth,
  open: $config.sidebar.defaultOpen,
  selectedTarget: null,
});

const MIN_WIDTH = 15;

function selectByOffset(files: GitFileTarget[], offset: number): GitFileTarget | null {
  if (files.length === 0) return null;

  const currentIndex = files.findIndex((file) =>
    isGitFileTargetEqual(file, sidebarState.selectedTarget),
  );
  const startIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (startIndex + offset + files.length) % files.length;

  return files[nextIndex] ?? null;
}

export const $sidebar = mergeProps(sidebarState, {
  action: {
    setSelectedTarget: (selectedTarget: GitFileTarget | null) => {
      setSidebarState("selectedTarget", selectedTarget);
    },
    selectNext: (files: GitFileTarget[]) => {
      setSidebarState("selectedTarget", selectByOffset(files, 1));
    },
    selectPrevious: (files: GitFileTarget[]) => {
      setSidebarState("selectedTarget", selectByOffset(files, -1));
    },
    toggle: () => {
      setSidebarState("open", (open) => !open);
    },
    increaseWidth: (delta: number = 5) => {
      setSidebarState(
        produce((state) => {
          if (!state.open) state.open = true;
          state.width += delta;
        }),
      );
    },
    decreaseWidth: (delta: number = 5) => {
      setSidebarState(
        produce((state) => {
          const nextWidth = state.width - delta;

          if (nextWidth <= MIN_WIDTH) {
            state.open = false;
            state.width = MIN_WIDTH;
            return;
          }

          if (!state.open) state.open = true;
          state.width = nextWidth;
        }),
      );
    },
  },
});
