import type { Component, ParentComponent } from "solid-js";
import { createContext, useContext } from "solid-js";
import type { SetStoreFunction, Store } from "solid-js/store";
import { createStore } from "solid-js/store";

export type DialogEntry = {
  component: Component;
  onClose?: () => void;
};

export type DialogStack = DialogEntry[];

type DialogChange = {
  stack: DialogStack;
  closed: DialogEntry[];
};

export function pushDialog(stack: DialogStack, entry: DialogEntry): DialogChange {
  return { stack: [...stack, entry], closed: [] };
}

export function replaceDialog(stack: DialogStack, entry: DialogEntry): DialogChange {
  return { stack: [entry], closed: stack };
}

export function closeDialog(stack: DialogStack): DialogChange {
  if (stack.length === 0) return { stack, closed: [] };

  return { stack: stack.slice(0, -1), closed: [stack.at(-1)!] };
}

export function clearDialog(stack: DialogStack): DialogChange {
  return { stack: [], closed: stack };
}

export function topDialog(stack: DialogStack): DialogEntry | null {
  return stack.at(-1) ?? null;
}

// --- State type ---

export type DialogState = {
  stack: DialogStack;
};

const INITIAL_STATE: DialogState = {
  stack: [],
};

// --- Private actions ---

function applyChange(setState: SetStoreFunction<DialogState>, change: DialogChange) {
  for (const entry of change.closed) {
    entry.onClose?.();
  }

  setState("stack", change.stack);
}

function show(setState: SetStoreFunction<DialogState>, stack: DialogStack, entry: DialogEntry) {
  applyChange(setState, pushDialog(stack, entry));
}

function replaceDialogAction(
  setState: SetStoreFunction<DialogState>,
  stack: DialogStack,
  entry: DialogEntry,
) {
  applyChange(setState, replaceDialog(stack, entry));
}

function closeAction(setState: SetStoreFunction<DialogState>, stack: DialogStack) {
  applyChange(setState, closeDialog(stack));
}

function clearAction(setState: SetStoreFunction<DialogState>, stack: DialogStack) {
  applyChange(setState, clearDialog(stack));
}

// --- Context + Provider ---

type DialogApi = {
  state: Store<DialogState>;
  show: (entry: DialogEntry) => void;
  replace: (entry: DialogEntry) => void;
  close: () => void;
  clear: () => void;
};

const DialogContext = createContext<DialogApi>();

export const DialogProvider: ParentComponent<{
  initialState?: Partial<DialogState>;
}> = (props) => {
  const [state, setState] = createStore<DialogState>({
    ...INITIAL_STATE,
    ...props.initialState,
  });

  const api: DialogApi = {
    state,
    show: (entry) => show(setState, state.stack, entry),
    replace: (entry) => replaceDialogAction(setState, state.stack, entry),
    close: () => closeAction(setState, state.stack),
    clear: () => clearAction(setState, state.stack),
  };

  return <DialogContext.Provider value={api}>{props.children}</DialogContext.Provider>;
};

export function useDialog(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error("useDialog must be used within DialogProvider");
  }
  return ctx;
}
