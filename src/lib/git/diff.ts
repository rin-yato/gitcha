import type { FileDiffSource } from "./types";

const BINARY_PATCH_MARKERS = ["Binary files ", "GIT binary patch"] as const;

export function isBinaryPatch(diff: string): boolean {
  return BINARY_PATCH_MARKERS.some((marker) => diff.includes(marker));
}

export function generateDiff(source: FileDiffSource, filePath: string): string {
  const header = source.originalPath
    ? `diff --git a/${source.originalPath} b/${filePath}\n--- a/${source.originalPath}\n+++ b/${filePath}`
    : `diff --git a/${filePath} b/${filePath}\n--- a/${filePath}\n+++ b/${filePath}`;

  return source.patch ? `${header}\n${source.patch}` : `${header}\n`;
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
  const lines = diff.split("\n");

  type DiffParseState = {
    changes: ChangePosition[];
    currentOldLine: number;
    currentNewLine: number;
    unifiedLine: number;
    totalLinesInNewFile: number;
    totalLinesInOldFile: number;
    totalUnifiedLines: number;
    inHunk: boolean;
  };

  const state: DiffParseState = {
    changes: [],
    currentOldLine: 0,
    currentNewLine: 0,
    unifiedLine: 0,
    totalLinesInNewFile: 0,
    totalLinesInOldFile: 0,
    totalUnifiedLines: 0,
    inHunk: false,
  };

  for (const line of lines) {
    if (line.startsWith("@@")) {
      const header = parseHunkHeader(line);
      if (!header) continue;

      state.currentOldLine = header.oldStart - 1;
      state.currentNewLine = header.newStart - 1;
      state.inHunk = true;
      continue;
    }

    if (!state.inHunk) continue;

    if (
      line.startsWith("diff --git ") ||
      line.startsWith("index ") ||
      line.startsWith("new file mode ") ||
      line.startsWith("deleted file mode ") ||
      line.startsWith("similarity index ") ||
      line.startsWith("rename from ") ||
      line.startsWith("rename to ") ||
      line.startsWith("Binary files ") ||
      line.startsWith("GIT binary patch")
    ) {
      continue;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      state.unifiedLine += 1;
      state.currentNewLine += 1;
      state.changes.push({
        lineInNewFile: state.currentNewLine - 1,
        lineInOldFile: state.currentOldLine,
        unifiedLine: state.unifiedLine,
        type: "addition",
      });
      state.totalLinesInNewFile = Math.max(state.totalLinesInNewFile, state.currentNewLine);
      state.totalUnifiedLines = Math.max(state.totalUnifiedLines, state.unifiedLine);
      continue;
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      state.unifiedLine += 1;
      state.currentOldLine += 1;
      state.changes.push({
        lineInNewFile: state.currentNewLine,
        lineInOldFile: state.currentOldLine - 1,
        unifiedLine: state.unifiedLine,
        type: "deletion",
      });
      state.totalLinesInOldFile = Math.max(state.totalLinesInOldFile, state.currentOldLine);
      state.totalUnifiedLines = Math.max(state.totalUnifiedLines, state.unifiedLine);
      continue;
    }

    if (!line.startsWith("\\")) {
      state.unifiedLine += 1;
      state.currentOldLine += 1;
      state.currentNewLine += 1;
      state.totalLinesInNewFile = Math.max(state.totalLinesInNewFile, state.currentNewLine);
      state.totalLinesInOldFile = Math.max(state.totalLinesInOldFile, state.currentOldLine);
      state.totalUnifiedLines = Math.max(state.totalUnifiedLines, state.unifiedLine);
    }
  }

  return {
    changes: state.changes,
    totalLinesInNewFile: state.totalLinesInNewFile,
    totalLinesInOldFile: state.totalLinesInOldFile,
    totalUnifiedLines: state.totalUnifiedLines,
  };
}

export interface ScrollbarMarker {
  lineInNewFile: number;
  position: number;
  type: "addition" | "deletion";
}

export function computeScrollbarMarkers(
  changeMap: DiffChangeMap,
  scrollHeight?: number,
): ScrollbarMarker[] {
  const totalLines = scrollHeight ?? changeMap.totalUnifiedLines;
  if (totalLines === 0) return [];

  return changeMap.changes.map((change) => ({
    lineInNewFile: change.lineInNewFile,
    position: change.unifiedLine / totalLines,
    type: change.type,
  }));
}
