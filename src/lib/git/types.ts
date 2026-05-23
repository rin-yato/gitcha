import type { Result } from "better-result";

import type { GitError } from "./errors";

export type GitResult<T, E extends GitError = GitError> = Result<T, E>;

export type GitFileStatus =
  | "?"
  | "A"
  | "M"
  | "D"
  | "R"
  | "C"
  | "U"
  | "!"
  | " "
  | "T"
  | "B"
  | "X";

export interface GitStatusFile {
  path: string;
  indexStatus: GitFileStatus;
  workingTreeStatus: GitFileStatus;
  originalPath?: string;
}

export type GitFileSection = "conflicts" | "staged" | "changes" | "review";

export interface GitFileTarget {
  path: string;
  section: GitFileSection;
}

export interface GitScopedFile {
  target: GitFileTarget;
  file: GitStatusFile;
}

export interface GitUnifiedDiffTarget extends GitStatusFile {
  section?: GitFileSection;
}

export interface CategorizedFiles {
  staged: GitStatusFile[];
  changes: GitStatusFile[];
  untracked: GitStatusFile[];
  conflicted: GitStatusFile[];
}

export interface FileTreeNode {
  name: string;
  path: string;
  isDirectory: boolean;
  children: FileTreeNode[];
  fileInfo?: GitStatusFile;
}

export interface FileTreeSnapshot {
  tree: FileTreeNode;
  orderedFiles: GitStatusFile[];
}

export interface GitRepoStatus {
  branch: string;
  upstream?: string;
  aheadCount: number;
  behindCount: number;
  files: CategorizedFiles;
  totalFiles: number;
  isRepo: boolean;
}

export type GitBranchScope = "local" | "remote";

export interface GitBranch {
  ref: string;
  name: string;
  scope: GitBranchScope;
  current: boolean;
  commitRef: string;
  upstream?: string;
  committedAt?: string;
  lastCommitTitle?: string;
  authorName?: string;
  authorEmail?: string;
}

export type GitBranchListOptions = {
  scope?: GitBranchScope | "all";
};

export type CompareMode = "base-branch" | "base-commit" | "single-commit";

export type CompareTarget = {
  mode: CompareMode;
  ref: string;
  label: string;
};

export interface CompareResolution {
  baseRef: string;
  compareRef: string;
  targetRef: string | null;
  revisionRange: string;
  baseLabel: string;
}

export interface GitCommit {
  ref: string;
  shortRef: string;
  title: string;
  description: string;
  message: string;
  authorName: string;
  authorEmail: string;
  authoredAt: string;
  committedAt: string;
  parentRefs: string[];
  origin: string;
}

export type GitCommitQuery = {
  search?: string;
  limit?: number;
  skip?: number;
  refs?: readonly string[];
  all?: boolean;
  path?: string;
  author?: string;
  since?: string;
  until?: string;
};

export type GitCommitReviewMode = Extract<CompareMode, "base-commit" | "single-commit">;

export type GitReviewTarget =
  | {
      mode: "single-commit";
      ref: string;
      label?: string;
    }
  | {
      mode: "base-commit";
      ref: string;
      compareRef?: string | null;
      includeUntracked?: boolean;
      label?: string;
    };

export interface GitReviewResolution {
  mode: GitCommitReviewMode;
  baseRef: string | null;
  compareRef: string | null;
  targetRef: string | null;
  revisionRange: string;
  baseLabel: string;
  isRootCommit: boolean;
  includeUntracked: boolean;
}

export interface GitReviewStatus {
  target: GitReviewTarget;
  resolution: GitReviewResolution;
  files: CategorizedFiles;
  totalFiles: number;
}

export interface FileDiffSource {
  patch: string;
  originalPath?: string;
}

export interface RepoContext {
  root: string;
  cwd: string;
  toRootPath: (relativePath: string) => string;
  toRelativePath: (absolutePath: string) => string;
}

export type RepoChangeKind = "content" | "metadata";

export type RepoMonitorMode = "native" | "polling";

export type RepoChangeListener = (kind: RepoChangeKind) => void;

export interface RepoMonitor {
  mode: RepoMonitorMode;
  dispose: () => Promise<void>;
}

export type GitCommandOutput = {
  args: readonly string[];
  cwd: string;
  exitCode: number;
  signal: string | null;
  stdout: Buffer;
  stderr: Buffer;
  stdoutText: string;
  stderrText: string;
  durationMs: number;
};

export type GitCommandOptions = {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string | Uint8Array | Buffer;
  encoding?: BufferEncoding;
  timeoutMs?: number;
  signal?: AbortSignal;
  maxBufferBytes?: number;
  successExitCodes?: readonly number[];
  dedupe?: boolean;
  onStdout?: (chunk: Buffer) => void;
  onStderr?: (chunk: Buffer) => void;
};

export interface GitExecutorLike {
  run(
    args: readonly string[],
    options?: GitCommandOptions,
  ): Promise<GitResult<GitCommandOutput>>;
  runText(args: readonly string[], options?: GitCommandOptions): Promise<GitResult<string>>;
}

export type GitCommandDependencies = {
  cwd?: string;
  executor: GitExecutorLike;
};

export type RecentCommitSummary = {
  ref: string;
  shortRef: string;
  message: string;
  origin: string;
};

export type GetRepoStatusOptions = {
  includeUntracked?: boolean;
};

export type FilePatchOptions = {
  fromRef?: string;
  toRef?: string | null;
  staged?: boolean;
  contextLines?: number;
  isNewFile?: boolean;
  repoRoot?: string;
};

export type BinaryDiffSection = "staged" | "changes" | "compare";

export type GitClientOptions = {
  cwd?: string;
  binary?: string;
  executor?: GitExecutorLike;
  timeoutMs?: number;
  maxConcurrency?: number;
};
