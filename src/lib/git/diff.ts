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

  const initialState: DiffParseState = {
    changes: [],
    currentOldLine: 0,
    currentNewLine: 0,
    unifiedLine: 0,
    totalLinesInNewFile: 0,
    totalLinesInOldFile: 0,
    totalUnifiedLines: 0,
    inHunk: false,
  };

  const finalState = lines.reduce<DiffParseState>((state, line) => {
    if (line.startsWith("@@")) {
      const header = parseHunkHeader(line);
      if (!header) return state;

      return {
        ...state,
        currentOldLine: header.oldStart - 1,
        currentNewLine: header.newStart - 1,
        inHunk: true,
      };
    }

    if (!state.inHunk) return state;

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
      return state;
    }

    if (line.startsWith("+") && !line.startsWith("+++")) {
      const nextUnifiedLine = state.unifiedLine + 1;
      const nextCurrentNewLine = state.currentNewLine + 1;

      return {
        ...state,
        changes: [
          ...state.changes,
          {
            lineInNewFile: state.currentNewLine,
            lineInOldFile: state.currentOldLine,
            unifiedLine: nextUnifiedLine,
            type: "addition",
          },
        ],
        currentNewLine: nextCurrentNewLine,
        unifiedLine: nextUnifiedLine,
        totalLinesInNewFile: Math.max(state.totalLinesInNewFile, nextCurrentNewLine),
        totalUnifiedLines: Math.max(state.totalUnifiedLines, nextUnifiedLine),
      };
    }

    if (line.startsWith("-") && !line.startsWith("---")) {
      const nextUnifiedLine = state.unifiedLine + 1;
      const nextCurrentOldLine = state.currentOldLine + 1;

      return {
        ...state,
        changes: [
          ...state.changes,
          {
            lineInNewFile: state.currentNewLine,
            lineInOldFile: state.currentOldLine,
            unifiedLine: nextUnifiedLine,
            type: "deletion",
          },
        ],
        currentOldLine: nextCurrentOldLine,
        unifiedLine: nextUnifiedLine,
        totalLinesInOldFile: Math.max(state.totalLinesInOldFile, nextCurrentOldLine),
        totalUnifiedLines: Math.max(state.totalUnifiedLines, nextUnifiedLine),
      };
    }

    if (!line.startsWith("\\")) {
      const nextUnifiedLine = state.unifiedLine + 1;
      const nextCurrentOldLine = state.currentOldLine + 1;
      const nextCurrentNewLine = state.currentNewLine + 1;

      return {
        ...state,
        currentOldLine: nextCurrentOldLine,
        currentNewLine: nextCurrentNewLine,
        unifiedLine: nextUnifiedLine,
        totalLinesInNewFile: Math.max(state.totalLinesInNewFile, nextCurrentNewLine),
        totalLinesInOldFile: Math.max(state.totalLinesInOldFile, nextCurrentOldLine),
        totalUnifiedLines: Math.max(state.totalUnifiedLines, nextUnifiedLine),
      };
    }

    return state;
  }, initialState);

  return {
    changes: finalState.changes,
    totalLinesInNewFile: finalState.totalLinesInNewFile,
    totalLinesInOldFile: finalState.totalLinesInOldFile,
    totalUnifiedLines: finalState.totalUnifiedLines,
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
