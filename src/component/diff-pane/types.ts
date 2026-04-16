import type { DiffRenderable, ScrollBoxRenderable, SyntaxStyle } from "@opentui/core";

import type { DiffViewMode } from "@/context/diff";
import type { Theme } from "@/context/theme";

import type { GitStatusFile } from "@/lib/git";

export interface DiffPaneProps {
  theme: Theme;
  selectedFile: string | null;
  selectedFileKey: string | null;
  selectedFileInfo: GitStatusFile | null;
  diffContent: string | null;
  diffViewMode: DiffViewMode;
  toggleDiffViewMode: () => void;
}

export interface DiffRenderablePaneProps {
  fileKey: string;
  diffContent: string;
  viewMode: DiffViewMode;
  theme: Theme;
  filetype: string;
  syntaxStyle: SyntaxStyle;
}

export interface DiffContentProps {
  fileKey: string;
  diffContent: string;
  viewMode: DiffViewMode;
  theme: Theme;
  filetype: string;
  syntaxStyle: SyntaxStyle;
  onHeightChange: (height: number) => void;
  onScrollStateChange: (state: {
    scrollTop: number;
    viewportHeight: number;
    scrollHeight: number;
  }) => void;
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

export type DiffRenderableRef = DiffRenderable | null;
export type ScrollBoxRenderableRef = ScrollBoxRenderable | null;

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
