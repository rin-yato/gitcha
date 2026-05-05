export type HexColor = `#${string}`;

export type ColorValue = HexColor | `var(--${string})`;

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
  overrides?: Record<string, ColorValue>;
}

export interface DesktopTheme {
  $schema?: string;
  name: string;
  id: string;
  light: ThemeVariant;
  dark: ThemeVariant;
}

export type ThemeMode = "light" | "dark";
