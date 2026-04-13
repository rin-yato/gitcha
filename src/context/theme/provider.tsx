import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

import type { DesktopTheme } from "@/themes/types";

import { DEFAULT_THEME_ID, THEMES, type ThemeId } from "@/themes";

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

export type ThemeMode = "light" | "dark";

export type ThemeSettings = {
  themeId: ThemeId;
  themeIds: ThemeId[];
  setThemeId: (themeId: ThemeId | string) => void;
};

function normalizeColor(value: string): string {
  if (value.startsWith("#") || value.startsWith("var(")) return value;
  if (/^[0-9a-fA-F]{6,8}$/.test(value)) return `#${value}`;
  return value;
}

function pick(...values: Array<string | undefined>): string {
  const value = values.find((entry): entry is string => Boolean(entry));
  return normalizeColor(value ?? "#000000");
}

export function resolveTheme(theme: DesktopTheme, mode: ThemeMode): Theme {
  const variant = theme[mode];
  const palette = variant.palette;
  const overrides = variant.overrides ?? {};

  return {
    background: pick(palette.neutral),
    surface: pick(overrides["surface-base"], overrides["surface-raised-base"], palette.neutral),
    border: pick(
      overrides["border-weak-base"],
      overrides["border-weaker-base"],
      overrides["text-weak"],
      overrides["syntax-comment"],
      palette.ink,
    ),
    text: pick(palette.ink),
    textMuted: pick(
      overrides["text-weak"],
      overrides["text-base"],
      overrides["syntax-comment"],
      palette.ink,
    ),
    accent: pick(palette.interactive, palette.primary, palette.accent, palette.info),
    added: pick(palette.diffAdd, palette.success),
    removed: pick(palette.diffDelete, palette.error),
    modified: pick(palette.warning, palette.accent, palette.primary),
    success: pick(palette.success),
    warning: pick(palette.warning),
    error: pick(palette.error),
    syntaxComment: pick(overrides["syntax-comment"], overrides["text-weak"], palette.ink),
    syntaxKeyword: pick(
      overrides["syntax-keyword"],
      palette.primary,
      palette.interactive,
      palette.accent,
      palette.info,
    ),
    syntaxFunction: pick(
      overrides["syntax-function"],
      overrides["syntax-primitive"],
      palette.primary,
      palette.interactive,
      palette.accent,
      palette.info,
    ),
    syntaxVariable: pick(overrides["syntax-variable"], palette.ink),
    syntaxString: pick(overrides["syntax-string"], palette.success),
    syntaxNumber: pick(
      overrides["syntax-number"],
      overrides["syntax-constant"],
      overrides["syntax-primitive"],
      palette.warning,
    ),
    syntaxType: pick(
      overrides["syntax-type"],
      overrides["syntax-property"],
      palette.info,
      palette.primary,
    ),
    syntaxOperator: pick(overrides["syntax-operator"], palette.info, palette.ink),
    syntaxPunctuation: pick(overrides["syntax-punctuation"], palette.ink),
  };
}

function getThemeId(themeId: string | undefined): ThemeId {
  if (themeId === "opencode-light") return "opencode";
  if (themeId && themeId in THEMES) return themeId as ThemeId;
  return DEFAULT_THEME_ID;
}

function getThemeMode(mode: string | undefined): ThemeMode {
  return mode === "dark" ? "dark" : "light";
}

const STORAGE_KEY_THEME_ID = "changes-theme-id";

function readStoredThemeId(): ThemeId | null {
  if (typeof localStorage !== "object") return null;

  try {
    const value = localStorage.getItem(STORAGE_KEY_THEME_ID);
    return value ? getThemeId(value) : null;
  } catch {
    return null;
  }
}

function writeStoredThemeId(themeId: ThemeId) {
  if (typeof localStorage !== "object") return;

  try {
    localStorage.setItem(STORAGE_KEY_THEME_ID, themeId);
  } catch {}
}

const DEFAULT_THEME_MODE_FROM_ENV = getThemeMode(process.env.CHANGES_THEME_MODE);
const defaultThemeId = readStoredThemeId() ?? getThemeId(process.env.CHANGES_THEME);
const defaultTheme = resolveTheme(THEMES[defaultThemeId], DEFAULT_THEME_MODE_FROM_ENV);

const ThemeContext = createContext<Theme>(defaultTheme);
const ThemeSettingsContext = createContext<ThemeSettings | null>(null);

export function ThemeProvider({
  children,
  themeId,
  mode,
}: {
  children: ReactNode;
  themeId?: string;
  mode?: ThemeMode;
}) {
  const [resolvedThemeId, setResolvedThemeId] = useState<ThemeId>(
    getThemeId(themeId ?? readStoredThemeId()?.toString() ?? process.env.CHANGES_THEME),
  );
  const resolvedMode = mode ?? getThemeMode(process.env.CHANGES_THEME_MODE);
  const theme = useMemo(
    () => resolveTheme(THEMES[resolvedThemeId], resolvedMode),
    [resolvedMode, resolvedThemeId],
  );
  const themeSettings = useMemo<ThemeSettings>(
    () => ({
      themeId: resolvedThemeId,
      themeIds: Object.keys(THEMES) as ThemeId[],
      setThemeId: (nextThemeId) => {
        const next = getThemeId(nextThemeId);
        setResolvedThemeId(next);
        writeStoredThemeId(next);
      },
    }),
    [resolvedThemeId],
  );

  return (
    <ThemeSettingsContext.Provider value={themeSettings}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </ThemeSettingsContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

export function useThemeSettings() {
  const context = useContext(ThemeSettingsContext);
  if (!context) {
    throw new Error("useThemeSettings must be used within ThemeProvider");
  }
  return context;
}
