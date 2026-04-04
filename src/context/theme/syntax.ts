import { getTreeSitterClient, parseColor, pathToFiletype, SyntaxStyle } from "@opentui/core";

import type { Theme } from "./provider";

export function detectFiletype(filePath: string | null): string | undefined {
  if (!filePath) return undefined;
  return pathToFiletype(filePath);
}

export function createSyntaxStyle(theme: Theme): SyntaxStyle {
  return SyntaxStyle.fromStyles({
    default: { fg: parseColor(theme.text) },
    comment: { fg: parseColor(theme.syntaxComment || theme.textMuted), italic: true },
    "comment.documentation": {
      fg: parseColor(theme.syntaxComment || theme.textMuted),
      italic: true,
    },
    keyword: { fg: parseColor(theme.syntaxKeyword || theme.accent), italic: true },
    "keyword.import": { fg: parseColor(theme.syntaxKeyword || theme.accent) },
    "keyword.return": { fg: parseColor(theme.syntaxKeyword || theme.accent), italic: true },
    "keyword.type": {
      fg: parseColor(theme.syntaxType || theme.modified),
      bold: true,
      italic: true,
    },
    string: { fg: parseColor(theme.syntaxString || theme.added) },
    "string.special": { fg: parseColor(theme.syntaxString || theme.added) },
    number: { fg: parseColor(theme.syntaxNumber || theme.modified) },
    boolean: { fg: parseColor(theme.syntaxNumber || theme.modified) },
    function: { fg: parseColor(theme.syntaxFunction || theme.accent) },
    "function.call": { fg: parseColor(theme.syntaxFunction || theme.accent) },
    "function.method": { fg: parseColor(theme.syntaxFunction || theme.accent) },
    type: { fg: parseColor(theme.syntaxType || theme.modified) },
    class: { fg: parseColor(theme.syntaxType || theme.modified) },
    module: { fg: parseColor(theme.syntaxType || theme.modified) },
    variable: { fg: parseColor(theme.syntaxVariable || theme.text) },
    "variable.parameter": { fg: parseColor(theme.syntaxVariable || theme.text) },
    property: { fg: parseColor(theme.syntaxVariable || theme.text) },
    parameter: { fg: parseColor(theme.syntaxVariable || theme.text) },
    operator: { fg: parseColor(theme.syntaxOperator || theme.textMuted) },
    punctuation: { fg: parseColor(theme.syntaxPunctuation || theme.textMuted) },
    "punctuation.bracket": { fg: parseColor(theme.syntaxPunctuation || theme.textMuted) },
    "punctuation.delimiter": { fg: parseColor(theme.syntaxPunctuation || theme.textMuted) },
  });
}

export const treeSitterClient = getTreeSitterClient();
