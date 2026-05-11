import { mergeProps } from "solid-js";
import { createStore } from "solid-js/store";

type ExCommandState = {
  visible: boolean;
};

const [exCommandState, setExCommandState] = createStore<ExCommandState>({
  visible: false,
});

export const $exCommand = mergeProps(exCommandState, {
  action: {
    open: () => {
      setExCommandState("visible", true);
    },
    close: () => {
      setExCommandState("visible", false);
    },
  },
});

export type { ExCommandState };
