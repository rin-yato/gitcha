import { batch, mergeProps } from "solid-js";
import { createStore, produce } from "solid-js/store";

import { $config } from "@/store/config.store";

import type { GitFileTarget } from "@/lib/git";
import { isGitFileTargetEqual } from "@/lib/git";

import { isSidebarDirectoryKeyForTarget } from "./sidebar-key";

export type SidebarViewMode = "flat" | "tree";

type SidebarState = {
  width: number;
  open: boolean;
  selectedTarget: GitFileTarget | null;
  viewMode: SidebarViewMode;
  collapsedDirectoryKeys: string[];
};

const [sidebarState, setSidebarState] = createStore<SidebarState>({
  width: $config.sidebar.defaultWidth,
  open: $config.sidebar.defaultOpen,
  selectedTarget: null,
  viewMode: "tree",
  collapsedDirectoryKeys: [],
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

function setSelectedTarget(selectedTarget: GitFileTarget | null): void {
  batch(() => {
    if (selectedTarget) {
      setSidebarState("collapsedDirectoryKeys", (keys) => {
        const nextKeys = keys.filter(
          (key) => !isSidebarDirectoryKeyForTarget(key, selectedTarget),
        );

        return nextKeys.length === keys.length ? keys : nextKeys;
      });
    }

    setSidebarState("selectedTarget", selectedTarget);
  });
}

export const $sidebar = mergeProps(sidebarState, {
  action: {
    setSelectedTarget,
    selectNext: (files: GitFileTarget[]) => {
      setSelectedTarget(selectByOffset(files, 1));
    },
    selectPrevious: (files: GitFileTarget[]) => {
      setSelectedTarget(selectByOffset(files, -1));
    },
    toggle: () => {
      setSidebarState("open", (open) => !open);
    },
    toggleViewMode: () => {
      setSidebarState("viewMode", (viewMode) => (viewMode === "flat" ? "tree" : "flat"));
    },
    toggleDirectory: (key: string) => {
      setSidebarState("collapsedDirectoryKeys", (keys) =>
        keys.includes(key) ? keys.filter((entry) => entry !== key) : [...keys, key],
      );
    },
    setCollapsedDirectoryKeys: (keys: readonly string[]) => {
      setSidebarState("collapsedDirectoryKeys", [...keys]);
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
