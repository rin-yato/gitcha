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

export interface ChangePosition {
  lineInNewFile: number;
  lineInOldFile: number;
  unifiedLine: number;
  type: "addition" | "deletion";
}

export interface DiffChangeMap {
  changes: ChangePosition[];
  totalLinesInNewFile: number;
  totalLinesInOldFile: number;
  totalUnifiedLines: number;
}

function parseHunkHeader(line: string): {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
} | null {
  const match = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
  if (!match) return null;

  return {
    oldStart: parseInt(match[1]!, 10),
    oldCount: match[2] ? parseInt(match[2], 10) : 1,
    newStart: parseInt(match[3]!, 10),
    newCount: match[4] ? parseInt(match[4], 10) : 1,
  };
}

export function parseDiffPositions(diff: string): DiffChangeMap {
  const changes: ChangePosition[] = [];
  const lines = diff.split("\n");

  let currentOldLine = 0;
  let currentNewLine = 0;
  let unifiedLine = 0;
  let totalLinesInNewFile = 0;
  let totalLinesInOldFile = 0;
  let totalUnifiedLines = 0;

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const header = parseHunkHeader(line);
      if (header) {
        currentOldLine = header.oldStart;
        currentNewLine = header.newStart;
      }
    } else if (line.startsWith("+") && !line.startsWith("+++")) {
      unifiedLine++;
      changes.push({
        lineInNewFile: currentNewLine,
        lineInOldFile: currentOldLine,
        unifiedLine,
        type: "addition",
      });
      currentNewLine++;
      totalLinesInNewFile = Math.max(totalLinesInNewFile, currentNewLine);
      totalUnifiedLines = Math.max(totalUnifiedLines, unifiedLine);
    } else if (line.startsWith("-") && !line.startsWith("---")) {
      unifiedLine++;
      changes.push({
        lineInNewFile: currentNewLine,
        lineInOldFile: currentOldLine,
        unifiedLine,
        type: "deletion",
      });
      currentOldLine++;
      totalLinesInOldFile = Math.max(totalLinesInOldFile, currentOldLine);
      totalUnifiedLines = Math.max(totalUnifiedLines, unifiedLine);
    } else if (!line.startsWith("\\")) {
      unifiedLine++;
      currentOldLine++;
      currentNewLine++;
      totalLinesInNewFile = Math.max(totalLinesInNewFile, currentNewLine);
      totalLinesInOldFile = Math.max(totalLinesInOldFile, currentOldLine);
      totalUnifiedLines = Math.max(totalUnifiedLines, unifiedLine);
    }
  }

  return { changes, totalLinesInNewFile, totalLinesInOldFile, totalUnifiedLines };
}

export interface ScrollbarMarker {
  lineInNewFile: number;
  position: number;
  type: "addition" | "deletion";
}

export function computeScrollbarMarkers(changeMap: DiffChangeMap): ScrollbarMarker[] {
  if (changeMap.totalUnifiedLines === 0) return [];

  return changeMap.changes.map((change) => ({
    lineInNewFile: change.lineInNewFile,
    position: change.unifiedLine / changeMap.totalUnifiedLines,
    type: change.type,
  }));
}
