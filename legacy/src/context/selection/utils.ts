import type { GitRepoStatus, GitStatusFile } from "@/lib/git";

import { sectionForIndex } from "../session/session";
import type { ViewMode } from "../view";

export type FileSection = "staged" | "changes" | "compare";
export type FileKey = `${FileSection}:${string}`;

export function buildFileKey(section: FileSection, path: string): FileKey {
  return `${section}:${path}`;
}

export function parseFileKey(key: string): { section: FileSection; path: string } | null {
  const colonIdx = key.indexOf(":");
  if (colonIdx === -1) return null;

  const section = key.slice(0, colonIdx) as FileSection;
  const path = key.slice(colonIdx + 1);

  if (!("staged,changes,compare".split(",") as string[]).includes(section)) return null;

  return { section, path };
}

export function stagedFileCount(status: GitRepoStatus | null): number {
  return status?.files.staged.length ?? 0;
}

export { sectionForIndex };

export function clampIndex(index: number, count: number): number {
  if (count === 0) return 0;
  return Math.max(0, Math.min(index, count - 1));
}

export function wrapIndex(index: number, count: number): number {
  if (count === 0) return 0;
  return ((index % count) + count) % count;
}

export function fileAtIndex(files: GitStatusFile[], index: number): GitStatusFile | null {
  return files[index] ?? null;
}

export function indexOfFile(files: GitStatusFile[], path: string): number {
  return files.findIndex((f) => f.path === path);
}

export function indexOfFileInSection(
  files: GitStatusFile[],
  path: string,
  section: FileSection,
  stagedCount: number,
  viewMode: ViewMode,
): number {
  return files.findIndex((file, index) => {
    if (file.path !== path) return false;
    const currentSection =
      viewMode === "compare" ? "compare" : sectionForIndex(index, stagedCount);
    return currentSection === section;
  });
}

export function fileKeyFromIndex(
  files: GitStatusFile[],
  index: number,
  stagedCount: number,
  viewMode: ViewMode,
): FileKey | null {
  const file = fileAtIndex(files, index);
  if (!file) return null;
  const section = viewMode === "compare" ? "compare" : sectionForIndex(index, stagedCount);
  return buildFileKey(section, file.path);
}
