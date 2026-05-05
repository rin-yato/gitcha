import type { GitStatusFile } from "@/lib/git";

import type { FileSection } from "@/context/selection/utils";
import type { Theme } from "@/context/theme/provider";

export type FileItemProps = {
  id: string;
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
