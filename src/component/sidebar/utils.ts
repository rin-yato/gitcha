import type { GitRepoStatus, GitStatusFile } from "@/lib/git/types";

export function collectSidebarFiles(status: GitRepoStatus | null): GitStatusFile[] {
  if (!status?.files) return [];

  return [
    ...status.files.conflicted,
    ...status.files.staged,
    ...status.files.changes,
    ...status.files.untracked,
  ];
}
