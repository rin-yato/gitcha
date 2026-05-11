import type { GitFileSection, GitFileTarget } from "@/lib/git";

export function createSidebarDirectoryKey(section: GitFileSection, path: string): string {
  return `${section}:${path}`;
}

export function isSidebarDirectoryKeyForTarget(key: string, target: GitFileTarget): boolean {
  const prefix = `${target.section}:`;
  if (!key.startsWith(prefix)) return false;

  const directoryPath = key.slice(prefix.length);
  return target.path === directoryPath || target.path.startsWith(`${directoryPath}/`);
}
