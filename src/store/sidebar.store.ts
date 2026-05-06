import { mergeProps } from "solid-js";
import { createStore, produce } from "solid-js/store";

import { $config } from "@/store/config.store";

import type { GitStatusFile } from "@/lib/git";

type SidebarState = {
  width: number;
  open: boolean;
  selectedPath: string | null;
};

const [sidebarState, setSidebarState] = createStore<SidebarState>({
  width: $config.sidebar.defaultWidth,
  open: $config.sidebar.defaultOpen,
  selectedPath: null,
});

const MIN_WIDTH = 15;

function selectByOffset(files: GitStatusFile[], offset: number): string | null {
  if (files.length === 0) return null;

  const currentIndex = files.findIndex((file) => file.path === sidebarState.selectedPath);
  const startIndex = currentIndex === -1 ? 0 : currentIndex;
  const nextIndex = (startIndex + offset + files.length) % files.length;

  return files[nextIndex]?.path ?? null;
}

export const $sidebar = mergeProps(sidebarState, {
  action: {
    setSelectedPath: (selectedPath: string | null) => {
      setSidebarState("selectedPath", selectedPath);
    },
    selectNext: (files: GitStatusFile[]) => {
      setSidebarState("selectedPath", selectByOffset(files, 1));
    },
    selectPrevious: (files: GitStatusFile[]) => {
      setSidebarState("selectedPath", selectByOffset(files, -1));
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
