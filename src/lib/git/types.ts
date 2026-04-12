/**
 * Git status file representation
 * XY format where X = index status, Y = working tree status
 */
export interface GitStatusFile {
  /** Path relative to repo root */
  path: string;
  /** Status in the index (staged) */
  indexStatus: GitFileStatus;
  /** Status in the working tree */
  workingTreeStatus: GitFileStatus;
  /** Original path if renamed/copied */
  originalPath?: string;
}

/**
 * Possible file statuses from git status --porcelain
 */
export type GitFileStatus =
  | "?" // Untracked
  | "A" // Added
  | "M" // Modified
  | "D" // Deleted
  | "R" // Renamed
  | "C" // Copied
  | "U" // Updated but unmerged
  | "!" // Ignored
  | " " // Unchanged
  | "T"; // Type changed

/**
 * Categorized file collections
 */
export interface CategorizedFiles {
  /** Files staged for commit (indexStatus !== " ") */
  staged: GitStatusFile[];
  /** Modified files not staged (indexStatus === " " && workingTreeStatus !== " ") */
  changes: GitStatusFile[];
  /** Untracked files (indexStatus === "?" || workingTreeStatus === "?") */
  untracked: GitStatusFile[];
  /** Conflict/unmerged files */
  conflicted: GitStatusFile[];
}

/**
 * Hierarchical tree node for file display
 */
export interface FileTreeNode {
  /** Display name (file or folder name) */
  name: string;
  /** Full path from repo root */
  path: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Child nodes if directory */
  children: FileTreeNode[];
  /** File status info (only for files) */
  fileInfo?: GitStatusFile;
}

/**
 * Complete git repository status
 */
export interface GitRepoStatus {
  /** Current branch name */
  branch: string;
  /** Upstream branch if any */
  upstream?: string;
  /** Number of commits ahead of upstream */
  aheadCount: number;
  /** Number of commits behind upstream */
  behindCount: number;
  /** All categorized files */
  files: CategorizedFiles;
  /** Total file count across all categories */
  totalFiles: number;
  /** Whether we're in a git repository */
  isRepo: boolean;
}

/**
 * A comparison target used by compare mode.
 */
export interface CompareTarget {
  /** Git ref used for the diff base. */
  ref: string;
  /** Human-readable label shown in the UI. */
  label: string;
}

/**
 * Branch compare state
 */
export interface CompareState {
  /** The base ref being compared against */
  baseRef: string;
  /** Human-readable label for the base */
  baseLabel: string;
  /** Files changed between baseBranch and HEAD */
  files: GitStatusFile[];
}

/**
 * Raw file versions used to generate a diff locally.
 * Base and current content are fetched independently, then a unified diff
 * is generated client-side via createTwoFilesPatch with context: Infinity.
 */
export interface FileDiffSource {
  /** Content at the base version (null = new file, no base exists) */
  baseContent: string | null;
  /** Content at the current version (null = deleted file, no current exists) */
  currentContent: string | null;
  /** Original path when the file was renamed or copied */
  originalPath?: string;
}

export type { RepoContext } from "./repo";
