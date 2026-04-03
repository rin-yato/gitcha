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
  // Syntax colors
  syntaxComment?: string;
  syntaxKeyword?: string;
  syntaxFunction?: string;
  syntaxVariable?: string;
  syntaxString?: string;
  syntaxNumber?: string;
  syntaxType?: string;
  syntaxOperator?: string;
  syntaxPunctuation?: string;
}

import opencodeLightThemeJson from "../themes/opencode-light.json";

function parseJsonTheme(json: any): Theme {
  const defs = json.defs || {};
  const theme = json.theme || {};

  const resolve = (val: string) => (defs[val] ? defs[val] : val);

  return {
    background: resolve(theme.background),
    surface: resolve(theme.backgroundElement || theme.background),
    border: resolve(theme.border),
    text: resolve(theme.text),
    textMuted: resolve(theme.textMuted),
    accent: resolve(theme.primary || theme.accent),
    added: resolve(theme.diffAdded || theme.success),
    removed: resolve(theme.diffRemoved || theme.error),
    modified: resolve(theme.warning),
    success: resolve(theme.success),
    warning: resolve(theme.warning),
    error: resolve(theme.error),
    // Syntax
    syntaxComment: resolve(theme.syntaxComment),
    syntaxKeyword: resolve(theme.syntaxKeyword),
    syntaxFunction: resolve(theme.syntaxFunction),
    syntaxVariable: resolve(theme.syntaxVariable),
    syntaxString: resolve(theme.syntaxString),
    syntaxNumber: resolve(theme.syntaxNumber),
    syntaxType: resolve(theme.syntaxType),
    syntaxOperator: resolve(theme.syntaxOperator),
    syntaxPunctuation: resolve(theme.syntaxPunctuation),
  };
}

const opencodeLightTheme = parseJsonTheme(opencodeLightThemeJson);

const defaultDarkTheme: Theme = {
  background: "#101418",
  surface: "#171c22",
  border: "#2b3340",
  text: "#d6dde8",
  textMuted: "#7f8a99",
  accent: "#8ca3c7",
  added: "#7ab69a",
  removed: "#c48888",
  modified: "#c9b17f",
  success: "#7ab69a",
  warning: "#c9b17f",
  error: "#c48888",
};

const defaultLightTheme: Theme = {
  background: "#f4f6f8",
  surface: "#e8edf2",
  border: "#d4dbe3",
  text: "#1e2732",
  textMuted: "#6e7885",
  accent: "#5d728f",
  added: "#4f8a69",
  removed: "#9d5f5f",
  modified: "#9a8151",
  success: "#4f8a69",
  warning: "#9a8151",
  error: "#9d5f5f",
};

function generateThemeFromPalette(palette: TerminalColors): Theme {
  const bg = palette.defaultBackground ?? "#1e1e2e";
  const fg = palette.defaultForeground ?? "#cdd6f4";

  const isLight = isLightColor(bg);
  const base = isLight ? defaultLightTheme : defaultDarkTheme;

  return {
    background: bg,
    surface: palette.palette[8] ?? adjustBrightness(bg, isLight ? -4 : 6),
    border: palette.palette[8] ?? base.border,
    text: fg,
    textMuted: palette.palette[8] ?? base.textMuted,
    accent: palette.palette[6] ?? base.accent,
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
    return opencodeLightTheme;
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
