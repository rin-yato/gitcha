import { createGitScopedFile } from "@/lib/git";
import type {
  GitFileSection,
  GitRepoStatus,
  GitScopedFile,
  GitStatusFile,
} from "@/lib/git/types";

export interface SidebarSectionModel {
  title: string;
  kind: GitFileSection;
  files: GitStatusFile[];
  count: number;
}

export function createSidebarSections(status: GitRepoStatus | null): SidebarSectionModel[] {
  if (!status?.files) return [];

  const changesFiles = [...status.files.changes, ...status.files.untracked];

  return [
    {
      title: "Conflicts",
      kind: "conflicts",
      files: status.files.conflicted,
      count: status.files.conflicted.length,
    },
    {
      title: "Staged",
      kind: "staged",
      files: status.files.staged,
      count: status.files.staged.length,
    },
    {
      title: "Changes",
      kind: "changes",
      files: changesFiles,
      count: changesFiles.length,
    },
  ];
}

export function collectSidebarFiles(status: GitRepoStatus | null): GitScopedFile[] {
  // Keep this in rendered order so keyboard navigation wraps across the visible rows.
  return createSidebarSections(status).flatMap((section) =>
    section.files.map((file) => createGitScopedFile(section.kind, file)),
  );
}
