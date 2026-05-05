export type HexColor = `#${string}`;

export interface ThemePaletteColors {
  neutral: HexColor;
  ink: HexColor;
  primary: HexColor;
  success: HexColor;
  warning: HexColor;
  error: HexColor;
  info: HexColor;
  accent?: HexColor;
  interactive?: HexColor;
  diffAdd?: HexColor;
  diffDelete?: HexColor;
}

export interface ThemeVariant {
  palette: ThemePaletteColors;
  overrides?: Record<string, string>;
}

export interface DesktopTheme {
  $schema?: string;
  name: string;
  id: string;
  light: ThemeVariant;
  dark: ThemeVariant;
}

export type ThemeMode = "light" | "dark";

export interface ThemeTokens {
  bg: HexColor;
  bgMuted: HexColor;
  fg: HexColor;
  fgMuted: HexColor;
  surface: HexColor;
  border: HexColor;
  accent: HexColor;
  accentFg: HexColor;
  added: HexColor;
  removed: HexColor;
  modified: HexColor;
  success: HexColor;
  warning: HexColor;
  error: HexColor;
  syntaxComment?: HexColor;
  syntaxKeyword?: HexColor;
  syntaxFunction?: HexColor;
  syntaxVariable?: HexColor;
  syntaxString?: HexColor;
  syntaxNumber?: HexColor;
  syntaxType?: HexColor;
  syntaxOperator?: HexColor;
  syntaxPunctuation?: HexColor;
}
