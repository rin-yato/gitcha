import type { Component } from "solid-js";
import { mergeProps } from "solid-js";
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

type DialogState = {
  stack: DialogStack;
};

const [dialogState, setDialogState] = createStore<DialogState>({
  stack: [],
});

function applyChange(change: { stack: DialogStack; closed: DialogEntry[] }) {
  // Run cleanup first so callbacks can enqueue follow-up dialogs on the updated stack.
  for (const entry of change.closed) {
    entry.onClose?.();
  }

  setDialogState("stack", change.stack);
}

function show(entry: DialogEntry) {
  applyChange(pushDialog(dialogState.stack, entry));
}

function replace(entry: DialogEntry) {
  applyChange(replaceDialog(dialogState.stack, entry));
}

function close() {
  applyChange(closeDialog(dialogState.stack));
}

function clear() {
  applyChange(clearDialog(dialogState.stack));
}

export const $dialog = mergeProps(dialogState, {
  action: {
    show,
    replace,
    close,
    clear,
  },
});

export type { DialogState };
