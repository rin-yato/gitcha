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
import type { DesktopTheme } from "./types";
import vercelThemeJson from "./vercel.json";
import vesperThemeJson from "./vesper.json";
import zenburnThemeJson from "./zenburn.json";

export const oc2Theme = oc2ThemeJson as DesktopTheme;
export const amoledTheme = amoledThemeJson as DesktopTheme;
export const auraTheme = auraThemeJson as DesktopTheme;
export const ayuTheme = ayuThemeJson as DesktopTheme;
export const carbonfoxTheme = carbonfoxThemeJson as DesktopTheme;
export const catppuccinTheme = catppuccinThemeJson as DesktopTheme;
export const catppuccinFrappeTheme = catppuccinFrappeThemeJson as DesktopTheme;
export const catppuccinMacchiatoTheme = catppuccinMacchiatoThemeJson as DesktopTheme;
export const cobalt2Theme = cobalt2ThemeJson as DesktopTheme;
export const cursorTheme = cursorThemeJson as DesktopTheme;
export const draculaTheme = draculaThemeJson as DesktopTheme;
export const everforestTheme = everforestThemeJson as DesktopTheme;
export const flexokiTheme = flexokiThemeJson as DesktopTheme;
export const githubTheme = githubThemeJson as DesktopTheme;
export const gruvboxTheme = gruvboxThemeJson as DesktopTheme;
export const kanagawaTheme = kanagawaThemeJson as DesktopTheme;
export const lucentOrngTheme = lucentOrngThemeJson as DesktopTheme;
export const materialTheme = materialThemeJson as DesktopTheme;
export const matrixTheme = matrixThemeJson as DesktopTheme;
export const mercuryTheme = mercuryThemeJson as DesktopTheme;
export const monokaiTheme = monokaiThemeJson as DesktopTheme;
export const nightowlTheme = nightowlThemeJson as DesktopTheme;
export const nordTheme = nordThemeJson as DesktopTheme;
export const oneDarkTheme = oneDarkThemeJson as DesktopTheme;
export const oneDarkProTheme = oneDarkProThemeJson as DesktopTheme;
export const opencodeTheme = opencodeThemeJson as DesktopTheme;
export const orngTheme = orngThemeJson as DesktopTheme;
export const osakaJadeTheme = osakaJadeThemeJson as DesktopTheme;
export const palenightTheme = palenightThemeJson as DesktopTheme;
export const rosepineTheme = rosepineThemeJson as DesktopTheme;
export const shadesOfPurpleTheme = shadesOfPurpleThemeJson as DesktopTheme;
export const solarizedTheme = solarizedThemeJson as DesktopTheme;
export const synthwave84Theme = synthwave84ThemeJson as DesktopTheme;
export const tokyonightTheme = tokyonightThemeJson as DesktopTheme;
export const vercelTheme = vercelThemeJson as DesktopTheme;
export const vesperTheme = vesperThemeJson as DesktopTheme;
export const zenburnTheme = zenburnThemeJson as DesktopTheme;

export const THEMES = {
  "oc-2": oc2Theme,
  amoled: amoledTheme,
  aura: auraTheme,
  ayu: ayuTheme,
  carbonfox: carbonfoxTheme,
  catppuccin: catppuccinTheme,
  "catppuccin-frappe": catppuccinFrappeTheme,
  "catppuccin-macchiato": catppuccinMacchiatoTheme,
  cobalt2: cobalt2Theme,
  cursor: cursorTheme,
  dracula: draculaTheme,
  everforest: everforestTheme,
  flexoki: flexokiTheme,
  github: githubTheme,
  gruvbox: gruvboxTheme,
  kanagawa: kanagawaTheme,
  "lucent-orng": lucentOrngTheme,
  material: materialTheme,
  matrix: matrixTheme,
  mercury: mercuryTheme,
  monokai: monokaiTheme,
  nightowl: nightowlTheme,
  nord: nordTheme,
  "one-dark": oneDarkTheme,
  onedarkpro: oneDarkProTheme,
  opencode: opencodeTheme,
  orng: orngTheme,
  "osaka-jade": osakaJadeTheme,
  palenight: palenightTheme,
  rosepine: rosepineTheme,
  shadesofpurple: shadesOfPurpleTheme,
  solarized: solarizedTheme,
  synthwave84: synthwave84Theme,
  tokyonight: tokyonightTheme,
  vercel: vercelTheme,
  vesper: vesperTheme,
  zenburn: zenburnTheme,
} satisfies Record<string, DesktopTheme>;

export type ThemeId = keyof typeof THEMES;

export const THEME_IDS = Object.keys(THEMES).sort() as ThemeId[];

export const DEFAULT_THEME_ID: ThemeId = "opencode";
