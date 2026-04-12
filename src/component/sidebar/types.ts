import type { Theme } from "@/context/theme/provider";

import type { GitStatusFile } from "@/lib/git";

export type FileSection = "staged" | "changes" | "compare";

export type FileItemProps = {
  file: GitStatusFile;
  isFocused: boolean;
  isSelected: boolean;
  onSelect: () => void;
  theme: Theme;
};

export type FileListProps = {
  title: string;
  count: number;
  countColor: string;
  files: GitStatusFile[];
  section: FileSection;
  focusedFileKey: string | null;
  selectedFileKey: string | null;
  onSelectFile: (path: string, section: FileSection) => void;
  theme: Theme;
};

export type BranchPickerProps = {
  branches: string[];
  currentBranch: string | null;
  selectedBranch: string | null;
  onSelectBranch: (branch: string) => void;
  theme: Theme;
};
