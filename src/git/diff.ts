import { createTwoFilesPatch } from "diff";

import type { FileDiffSource } from "./types";

/**
 * Generate a unified diff string from raw file versions.
 *
 * Uses context: Infinity so every line from both files is included,
 * allowing the <diff> component to render the complete file with
 * changes highlighted — like VSCode's full-file diff view.
 */
export function generateDiff(source: FileDiffSource, filePath: string): string {
  const base = source.baseContent ?? "";
  const current = source.currentContent ?? "";

  return createTwoFilesPatch(filePath, filePath, base, current, undefined, undefined, {
    context: Infinity,
  });
}
