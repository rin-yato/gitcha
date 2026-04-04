import type React from "react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type DialogSize = "small" | "medium" | "large";

type DialogEntry = {
  element: React.ReactNode;
  onClose?: () => void;
};

export type DialogState = {
  stack: DialogEntry[];
  size: DialogSize;
  show: (element: React.ReactNode, onClose?: () => void) => void;
  replace: (element: React.ReactNode, onClose?: () => void) => void;
  clear: () => void;
  closeTop: () => void;
  setSize: (size: DialogSize) => void;
};

const DialogContext = createContext<DialogState | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [stack, setStack] = useState<DialogEntry[]>([]);
  const [size, setSize] = useState<DialogSize>("medium");

  const show = useCallback((element: React.ReactNode, onClose?: () => void) => {
    setStack((prev) => [...prev, { element, onClose }]);
  }, []);

  const replace = useCallback((element: React.ReactNode, onClose?: () => void) => {
    setStack((prev) => {
      for (const entry of prev) {
        entry.onClose?.();
      }
      return [{ element, onClose }];
    });
  }, []);

  const clear = useCallback(() => {
    setStack((prev) => {
      for (const entry of prev) {
        entry.onClose?.();
      }
      return [];
    });
    setSize("medium");
  }, []);

  const closeTop = useCallback(() => {
    setStack((prev) => {
      if (prev.length === 0) return prev;
      const top = prev[prev.length - 1];
      top?.onClose?.();
      return prev.slice(0, -1);
    });
  }, []);

  const value = useMemo<DialogState>(
    () => ({
      stack,
      size,
      show,
      replace,
      clear,
      closeTop,
      setSize,
    }),
    [stack, size, show, replace, clear, closeTop],
  );

  const topDialog = stack.length > 0 ? stack[stack.length - 1] : null;

  return (
    <DialogContext.Provider value={value}>
      {children}
      {topDialog ? (
        <box position="absolute" top={0} left={0} width="100%" height="100%" zIndex={3000}>
          {topDialog.element}
        </box>
      ) : null}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}
