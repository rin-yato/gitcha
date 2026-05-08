import { mergeProps } from "solid-js";
import { createStore } from "solid-js/store";

type ToastVariant = "success" | "error" | "info" | "warning";

type ToastOptions = {
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
};

type ToastState = {
  current: ToastOptions | null;
};

const [toastState, setToastState] = createStore<ToastState>({
  current: null,
});

let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function show(options: ToastOptions) {
  clearTimer();
  setToastState("current", options);

  timer = setTimeout(() => {
    setToastState("current", null);
    timer = null;
  }, options.duration ?? 3000);
}

function clear() {
  clearTimer();
  setToastState("current", null);
}

export const $toast = mergeProps(toastState, {
  action: {
    show,
    clear,
    error: (message: string) => show({ variant: "error", title: message }),
    success: (message: string) => show({ variant: "success", title: message }),
    info: (message: string) => show({ variant: "info", title: message }),
    warning: (message: string) => show({ variant: "warning", title: message }),
  },
});

export type { ToastOptions, ToastState, ToastVariant };
