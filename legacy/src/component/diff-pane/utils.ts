import { useMemo } from "react";

import type { GitStatusFile } from "@/lib/git";
import { computeScrollbarMarkers, parseDiffPositions } from "@/lib/git";

import type { ScrollbarMetrics, ScrollState } from "./types";

const SCROLLBAR_WIDTH = 1;

export function computeScrollbarMetrics(
  viewportHeight: number,
  scrollHeight: number,
  scrollTop: number,
): ScrollbarMetrics {
  if (scrollHeight <= viewportHeight || viewportHeight === 0) {
    return {
      thumbHeight: viewportHeight,
      thumbTop: 0,
      showScrollbar: false,
    };
  }

  const ratio = viewportHeight / scrollHeight;
  const thumbHeight = Math.max(1, Math.round(ratio * viewportHeight));
  const maxScroll = scrollHeight - viewportHeight;
  const scrollRatio = scrollTop / maxScroll;
  const thumbTop = Math.round(scrollRatio * (viewportHeight - thumbHeight));

  return {
    thumbHeight,
    thumbTop,
    showScrollbar: true,
  };
}

export function useScrollbarMarkers(diffContent: string | null) {
  return useMemo(() => {
    if (!diffContent) return [];
    const changeInfo = parseDiffPositions(diffContent);
    if (!changeInfo) return [];
    return computeScrollbarMarkers(changeInfo, changeInfo.totalUnifiedLines);
  }, [diffContent]);
}

export function formatHeaderLabel(
  selectedFile: string | null,
  selectedFileInfo: GitStatusFile | null,
): string {
  if (!selectedFile) return "no file selected";

  if (selectedFileInfo?.originalPath) {
    return `${selectedFile} · Renamed from ${selectedFileInfo.originalPath}`;
  }

  return selectedFile;
}

export function shouldShowDiff(
  selectedFileKey: string | null,
  selectedFile: string | null,
  diffContent: string | null,
): boolean {
  return Boolean(selectedFileKey && selectedFile && diffContent);
}

export const defaultScrollState: ScrollState = {
  scrollTop: 0,
  viewportHeight: 0,
  scrollHeight: 0,
};

export { SCROLLBAR_WIDTH };
