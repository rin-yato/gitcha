import type React from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type { Theme } from "@/context/theme/provider";

type ToastVariant = "success" | "error" | "info" | "warning";

type ToastOptions = {
  variant: ToastVariant;
  title?: string;
  message: string;
  duration?: number;
};

export type ToastState = {
  current: ToastOptions | null;
  show: (options: ToastOptions) => void;
  error: (message: string) => void;
  success: (message: string) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastState | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<ToastOptions | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const show = useCallback(
    (options: ToastOptions) => {
      clearTimer();
      setCurrent(options);
      const duration = options.duration ?? 3000;
      timerRef.current = setTimeout(() => {
        setCurrent(null);
      }, duration);
    },
    [clearTimer],
  );

  const error = useCallback((message: string) => show({ variant: "error", message }), [show]);

  const success = useCallback(
    (message: string) => show({ variant: "success", message }),
    [show],
  );

  const clear = useCallback(() => {
    clearTimer();
    setCurrent(null);
  }, [clearTimer]);

  useEffect(() => {
    return () => clearTimer();
  }, [clearTimer]);

  const value = useMemo<ToastState>(
    () => ({ current, show, error, success, clear }),
    [current, show, error, success, clear],
  );

  return <ToastContext.Provider value={value}>{children}</ToastContext.Provider>;
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const VARIANT_COLORS: Record<ToastVariant, keyof Theme> = {
  success: "success",
  error: "error",
  info: "accent",
  warning: "warning",
};

export function Toast({ theme }: { theme: Theme }) {
  const toast = useContext(ToastContext);
  if (!toast?.current) return null;

  const { variant, title, message } = toast.current;
  const borderColor = theme[VARIANT_COLORS[variant]];

  return (
    <box
      position="absolute"
      top={2}
      right={2}
      maxWidth={60}
      paddingLeft={2}
      paddingRight={2}
      paddingTop={1}
      paddingBottom={1}
      backgroundColor={theme.surface}
      border
      borderColor={borderColor}
      zIndex={4000}
      flexDirection="column"
    >
      {title ? (
        <text attributes={1} fg={theme.text} selectable={false}>
          {title}
        </text>
      ) : null}
      <text fg={theme.text} selectable={false}>
        {message}
      </text>
    </box>
  );
}
