import { createContext, type ParentComponent, useContext } from "solid-js";
import type { SetStoreFunction, Store } from "solid-js/store";
import { createStore } from "solid-js/store";

export type ToastVariant = "success" | "error" | "info" | "warning";

export type ToastOptions = {
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
};

export type ToastState = {
  current: ToastOptions | null;
};

const INITIAL_STATE: ToastState = {
  current: null,
};

// --- Pure actions ---

function show(setState: SetStoreFunction<ToastState>, options: ToastOptions) {
  setState("current", options);
}

function clear(setState: SetStoreFunction<ToastState>) {
  setState("current", null);
}

// --- Context + Provider ---

type ToastApi = {
  state: Store<ToastState>;
  show: (options: ToastOptions) => void;
  clear: () => void;
  error: (message: string) => void;
  success: (message: string) => void;
  info: (message: string) => void;
  warning: (message: string) => void;
};

const ToastContext = createContext<ToastApi>();

export const ToastProvider: ParentComponent<{
  initialState?: Partial<ToastState>;
}> = (props) => {
  const [state, setState] = createStore<ToastState>({
    ...INITIAL_STATE,
    ...props.initialState,
  });

  const api: ToastApi = {
    state,
    show: (options) => show(setState, options),
    clear: () => clear(setState),
    error: (message: string) => show(setState, { variant: "error", title: message }),
    success: (message: string) => show(setState, { variant: "success", title: message }),
    info: (message: string) => show(setState, { variant: "info", title: message }),
    warning: (message: string) => show(setState, { variant: "warning", title: message }),
  };

  return <ToastContext.Provider value={api}>{props.children}</ToastContext.Provider>;
};

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
