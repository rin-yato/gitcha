import type {
  GitFileSection,
  GitFileTarget,
  GitScopedFile,
  GitStatusFile,
  GitUnifiedDiffTarget,
} from "./types";

export function createGitFileTarget(section: GitFileSection, path: string): GitFileTarget {
  return { section, path };
}

export function createGitScopedFile(
  section: GitFileSection,
  file: GitStatusFile,
): GitScopedFile {
  return {
    target: createGitFileTarget(section, file.path),
    file,
  };
}

// A partially staged file needs the row section to decide whether to diff the index or worktree.
export function toGitUnifiedDiffTarget(scopedFile: GitScopedFile): GitUnifiedDiffTarget {
  return {
    ...scopedFile.file,
    section: scopedFile.target.section,
  };
}

export function isGitFileTargetEqual(
  left: GitFileTarget | null | undefined,
  right: GitFileTarget | null | undefined,
): boolean {
  if (!left || !right) return left === right;
  return left.path === right.path && left.section === right.section;
}

export function findGitScopedFile(
  files: readonly GitScopedFile[],
  target: GitFileTarget | null | undefined,
): GitScopedFile | null {
  return files.find((file) => isGitFileTargetEqual(file.target, target)) ?? null;
}
