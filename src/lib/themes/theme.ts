import { parseColor, SyntaxStyle } from "@opentui/core";

import type { DesktopTheme, HexColor, ThemeMode, ThemeTokens } from "./types";

function normalizeColor(value: string): value is HexColor {
  return /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value);
}

function toHexColor(value: string): HexColor | null {
  if (normalizeColor(value)) return value;
  if (/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value)) {
    const prefixed = `#${value}`;
    return normalizeColor(prefixed) ? prefixed : null;
  }

  return null;
}

function pick(...values: Array<string | undefined>): HexColor {
  for (const value of values) {
    if (!value) continue;

    const color = toHexColor(value);
    if (color) return color;
  }

  return "#000000";
}

export function resolveThemeTokens(theme: DesktopTheme, mode: ThemeMode): ThemeTokens {
  const variant = theme[mode];
  const palette = variant.palette;
  const overrides = variant.overrides ?? {};

  return {
    bg: pick(palette.neutral),
    bgMuted: pick(overrides["surface-raised-base"], palette.neutral),
    fg: pick(palette.ink),
    fgMuted: pick(overrides["text-weak"], overrides["text-base"], palette.ink),
    surface: pick(overrides["surface-base"], overrides["surface-raised-base"], palette.neutral),
    border: pick(
      overrides["border-weak-base"],
      overrides["border-weaker-base"],
      overrides["text-weak"],
      overrides["syntax-comment"],
      palette.ink,
    ),
    accent: pick(palette.interactive, palette.primary, palette.accent, palette.info),
    accentFg: pick(palette.neutral, palette.ink),
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

export function createSyntaxStyle(tokens: ThemeTokens): SyntaxStyle {
  return SyntaxStyle.fromStyles({
    default: { fg: parseColor(tokens.fg) },
    comment: { fg: parseColor(tokens.syntaxComment || tokens.fgMuted), italic: true },
    "comment.documentation": {
      fg: parseColor(tokens.syntaxComment || tokens.fgMuted),
      italic: true,
    },
    keyword: { fg: parseColor(tokens.syntaxKeyword || tokens.accent), italic: true },
    "keyword.import": { fg: parseColor(tokens.syntaxKeyword || tokens.accent) },
    "keyword.return": { fg: parseColor(tokens.syntaxKeyword || tokens.accent), italic: true },
    "keyword.type": {
      fg: parseColor(tokens.syntaxType || tokens.modified),
      bold: true,
      italic: true,
    },
    string: { fg: parseColor(tokens.syntaxString || tokens.added) },
    "string.special": { fg: parseColor(tokens.syntaxString || tokens.added) },
    number: { fg: parseColor(tokens.syntaxNumber || tokens.modified) },
    boolean: { fg: parseColor(tokens.syntaxNumber || tokens.modified) },
    function: { fg: parseColor(tokens.syntaxFunction || tokens.accent) },
    "function.call": { fg: parseColor(tokens.syntaxFunction || tokens.accent) },
    "function.method": { fg: parseColor(tokens.syntaxFunction || tokens.accent) },
    type: { fg: parseColor(tokens.syntaxType || tokens.modified) },
    class: { fg: parseColor(tokens.syntaxType || tokens.modified) },
    module: { fg: parseColor(tokens.syntaxType || tokens.modified) },
    variable: { fg: parseColor(tokens.syntaxVariable || tokens.fg) },
    "variable.parameter": { fg: parseColor(tokens.syntaxVariable || tokens.fg) },
    property: { fg: parseColor(tokens.syntaxVariable || tokens.fg) },
    parameter: { fg: parseColor(tokens.syntaxVariable || tokens.fg) },
    operator: { fg: parseColor(tokens.syntaxOperator || tokens.fgMuted) },
    punctuation: { fg: parseColor(tokens.syntaxPunctuation || tokens.fgMuted) },
    "punctuation.bracket": { fg: parseColor(tokens.syntaxPunctuation || tokens.fgMuted) },
    "punctuation.delimiter": { fg: parseColor(tokens.syntaxPunctuation || tokens.fgMuted) },
  });
}
