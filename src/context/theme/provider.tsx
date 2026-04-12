import type React from "react";
import { createContext, useContext, useMemo } from "react";

import opencodeLightThemeJson from "@/themes/opencode-light.json";

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

const ThemeContext = createContext<Theme>(opencodeLightTheme);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useMemo(() => opencodeLightTheme, []);
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
