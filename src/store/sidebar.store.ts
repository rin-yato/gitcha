import { mergeProps } from "solid-js";
import { createStore, produce } from "solid-js/store";

import { $config } from "@/store/config.store";

type SidebarState = {
  width: number;
  open: boolean;
};

const [sidebarState, setSidebarState] = createStore<SidebarState>({
  width: $config.sidebar.defaultWidth,
  open: $config.sidebar.defaultOpen,
});

const MIN_WIDTH = 15;

export const $sidebar = mergeProps(sidebarState, {
  action: {
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
