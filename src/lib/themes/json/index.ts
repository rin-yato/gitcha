import type { DesktopTheme, ThemeMode } from "../types";
import amoledThemeJson from "./amoled.json";
import auraThemeJson from "./aura.json";
import ayuThemeJson from "./ayu.json";
import carbonfoxThemeJson from "./carbonfox.json";
import catppuccinThemeJson from "./catppuccin.json";
import catppuccinFrappeThemeJson from "./catppuccin-frappe.json";
import catppuccinMacchiatoThemeJson from "./catppuccin-macchiato.json";
import cobalt2ThemeJson from "./cobalt2.json";
import cursorThemeJson from "./cursor.json";
import draculaThemeJson from "./dracula.json";
import everforestThemeJson from "./everforest.json";
import flexokiThemeJson from "./flexoki.json";
import githubThemeJson from "./github.json";
import gruvboxThemeJson from "./gruvbox.json";
import kanagawaThemeJson from "./kanagawa.json";
import lucentOrngThemeJson from "./lucent-orng.json";
import materialThemeJson from "./material.json";
import matrixThemeJson from "./matrix.json";
import mercuryThemeJson from "./mercury.json";
import monokaiThemeJson from "./monokai.json";
import nightowlThemeJson from "./nightowl.json";
import nordThemeJson from "./nord.json";
import oc2ThemeJson from "./oc-2.json";
import oneDarkThemeJson from "./one-dark.json";
import oneDarkProThemeJson from "./onedarkpro.json";
import opencodeThemeJson from "./opencode.json";
import orngThemeJson from "./orng.json";
import osakaJadeThemeJson from "./osaka-jade.json";
import palenightThemeJson from "./palenight.json";
import rosepineThemeJson from "./rosepine.json";
import shadesOfPurpleThemeJson from "./shadesofpurple.json";
import solarizedThemeJson from "./solarized.json";
import synthwave84ThemeJson from "./synthwave84.json";
import tokyonightThemeJson from "./tokyonight.json";
import vercelThemeJson from "./vercel.json";
import vesperThemeJson from "./vesper.json";
import zenburnThemeJson from "./zenburn.json";

export const THEMES = {
  "oc-2": oc2ThemeJson as DesktopTheme,
  amoled: amoledThemeJson as DesktopTheme,
  aura: auraThemeJson as DesktopTheme,
  ayu: ayuThemeJson as DesktopTheme,
  carbonfox: carbonfoxThemeJson as DesktopTheme,
  catppuccin: catppuccinThemeJson as DesktopTheme,
  "catppuccin-frappe": catppuccinFrappeThemeJson as DesktopTheme,
  "catppuccin-macchiato": catppuccinMacchiatoThemeJson as DesktopTheme,
  cobalt2: cobalt2ThemeJson as DesktopTheme,
  cursor: cursorThemeJson as DesktopTheme,
  dracula: draculaThemeJson as DesktopTheme,
  everforest: everforestThemeJson as DesktopTheme,
  flexoki: flexokiThemeJson as DesktopTheme,
  github: githubThemeJson as DesktopTheme,
  gruvbox: gruvboxThemeJson as DesktopTheme,
  kanagawa: kanagawaThemeJson as DesktopTheme,
  "lucent-orng": lucentOrngThemeJson as DesktopTheme,
  material: materialThemeJson as DesktopTheme,
  matrix: matrixThemeJson as DesktopTheme,
  mercury: mercuryThemeJson as DesktopTheme,
  monokai: monokaiThemeJson as DesktopTheme,
  nightowl: nightowlThemeJson as DesktopTheme,
  nord: nordThemeJson as DesktopTheme,
  "one-dark": oneDarkThemeJson as DesktopTheme,
  onedarkpro: oneDarkProThemeJson as DesktopTheme,
  opencode: opencodeThemeJson as DesktopTheme,
  orng: orngThemeJson as DesktopTheme,
  "osaka-jade": osakaJadeThemeJson as DesktopTheme,
  palenight: palenightThemeJson as DesktopTheme,
  rosepine: rosepineThemeJson as DesktopTheme,
  shadesofpurple: shadesOfPurpleThemeJson as DesktopTheme,
  solarized: solarizedThemeJson as DesktopTheme,
  synthwave84: synthwave84ThemeJson as DesktopTheme,
  tokyonight: tokyonightThemeJson as DesktopTheme,
  vercel: vercelThemeJson as DesktopTheme,
  vesper: vesperThemeJson as DesktopTheme,
  zenburn: zenburnThemeJson as DesktopTheme,
} as const satisfies Record<string, DesktopTheme>;

export type ThemeId = keyof typeof THEMES;
export const THEME_IDS = Object.keys(THEMES).sort() as ThemeId[];
export const DEFAULT_THEME_ID: ThemeId = "opencode";

export function getTheme(themeId: ThemeId) {
  return THEMES[themeId];
}

export function isThemeId(value: string): value is ThemeId {
  return value in THEMES;
}

export function normalizeThemeId(value: string | undefined | null): ThemeId {
  if (value && isThemeId(value)) {
    return value;
  }

  return DEFAULT_THEME_ID;
}

export function getThemeMode(value: string | undefined | null): ThemeMode {
  return value === "dark" ? "dark" : "light";
}
