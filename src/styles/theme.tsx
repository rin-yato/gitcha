import type { TerminalColors } from "@opentui/core";
import { useRenderer } from "@opentui/solid";

import { createContext, createMemo, createResource, useContext } from "solid-js";

export interface Theme {
  background: string;
  surface: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  added: string;
  removed: string;
  modified: string;
  success: string;
  warning: string;
  error: string;
}

const defaultDarkTheme: Theme = {
  background: "#1e1e2e",
  surface: "#313244",
  border: "#45475a",
  text: "#cdd6f4",
  textMuted: "#6c7086",
  accent: "#89b4fa",
  added: "#a6e3a1",
  removed: "#f38ba8",
  modified: "#f9e2af",
  success: "#a6e3a1",
  warning: "#f9e2af",
  error: "#f38ba8",
};

const defaultLightTheme: Theme = {
  background: "#eff1f5",
  surface: "#e6e9ef",
  border: "#ccd0da",
  text: "#4c4f69",
  textMuted: "#8c8fa1",
  accent: "#1e66f5",
  added: "#40a02b",
  removed: "#d20f39",
  modified: "#df8e1d",
  success: "#40a02b",
  warning: "#df8e1d",
  error: "#d20f39",
};

function generateThemeFromPalette(palette: TerminalColors): Theme {
  const bg = palette.defaultBackground ?? "#1e1e2e";
  const fg = palette.defaultForeground ?? "#cdd6f4";

  const isLight = isLightColor(bg);
  const base = isLight ? defaultLightTheme : defaultDarkTheme;

  return {
    background: bg,
    surface: palette.palette[8] ?? adjustBrightness(bg, isLight ? -10 : 10),
    border: palette.palette[8] ?? base.border,
    text: fg,
    textMuted: palette.palette[8] ?? base.textMuted,
    accent: palette.palette[4] ?? base.accent,
    added: palette.palette[2] ?? base.added,
    removed: palette.palette[1] ?? base.removed,
    modified: palette.palette[3] ?? base.modified,
    success: palette.palette[2] ?? base.success,
    warning: palette.palette[3] ?? base.warning,
    error: palette.palette[1] ?? base.error,
  };
}

function isLightColor(hex: string): boolean {
  const rgb = parseInt(hex.slice(1), 16);
  const r = (rgb >> 16) & 0xff;
  const g = (rgb >> 8) & 0xff;
  const b = (rgb >> 0) & 0xff;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 128;
}

function adjustBrightness(hex: string, percent: number): string {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, Math.min(255, (num >> 16) + amt));
  const G = Math.max(0, Math.min(255, ((num >> 8) & 0x00ff) + amt));
  const B = Math.max(0, Math.min(255, (num & 0x0000ff) + amt));
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

const ThemeContext = createContext<() => Theme>(() => defaultDarkTheme);

export function ThemeProvider(props: { children: any }) {
  const renderer = useRenderer();
  const [palette] = createResource(() => renderer.getPalette());

  const theme = createMemo(() => {
    if (palette.loading || palette.error) {
      return renderer.themeMode === "light" ? defaultLightTheme : defaultDarkTheme;
    }
    return generateThemeFromPalette(palette()!);
  });

  return <ThemeContext.Provider value={theme}>{props.children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
