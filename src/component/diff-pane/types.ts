import type { DiffViewMode } from "@/context/diff";
import type { Theme } from "@/context/theme";
import type { createSyntaxStyle } from "@/context/theme/syntax";

import type { GitStatusFile } from "@/lib/git";

import type { ChangesRenderable } from "@/renderable/changes";

export interface DiffPaneProps {
  theme: Theme;
  selectedFile: string | null;
  selectedFileKey: string | null;
  selectedFileInfo: GitStatusFile | null;
  diffContent: string | null;
  unsupportedReason?: string | null;
  diffViewMode: DiffViewMode;
  toggleDiffViewMode: () => void;
}

export interface DiffRenderablePaneProps {
  fileKey: string;
  diffContent: string;
  viewMode: DiffViewMode;
  theme: Theme;
  filetype: string;
  syntaxStyle: ReturnType<typeof createSyntaxStyle>;
}

export interface DiffContentProps {
  fileKey: string;
  diffContent: string;
  viewMode: DiffViewMode;
  theme: Theme;
  filetype: string;
  syntaxStyle: ReturnType<typeof createSyntaxStyle>;
  onScrollStateChange: (
    scrollTop: number,
    viewportHeight: number,
    scrollHeight: number,
  ) => void;
}

export interface ScrollbarProps {
  viewportHeight: number;
  scrollHeight: number;
  scrollTop: number;
  surfaceColor: string;
  thumbColor: string;
}

export interface ScrollbarMarkersProps {
  markers: Array<{
    position: number;
    type: "addition" | "deletion";
  }>;
  addedColor: string;
  removedColor: string;
}

export interface DiffHeaderProps {
  label: string;
  viewMode: DiffViewMode;
  theme: Theme;
}

export type DiffRenderableRef = ChangesRenderable | null;

export interface ScrollState {
  scrollTop: number;
  viewportHeight: number;
  scrollHeight: number;
}

export interface ScrollbarMetrics {
  thumbHeight: number;
  thumbTop: number;
  showScrollbar: boolean;
}
