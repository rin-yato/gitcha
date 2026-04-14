import { buildFileKey, type FileSection } from "@/context/selection/utils";
import type { Theme } from "@/context/theme/provider";

import type { FileTreeNode, GitStatusFile } from "@/lib/git";
import { buildFileTree } from "@/lib/git";

// Status icons - minimal, single character
const STATUS_ICONS: Record<string, string> = {
  A: "+",
  M: "~",
  D: "-",
  R: "→",
  C: "≡",
  U: "!",
  "?": "?",
  " ": "·",
};

// Status colors mapped to theme
const STATUS_COLORS: Record<string, (theme: Theme) => string> = {
  A: (t) => t.added,
  M: (t) => t.modified,
  D: (t) => t.removed,
  R: (t) => t.accent,
  C: (t) => t.accent,
  U: (t) => t.warning,
  "?": (t) => t.textMuted,
  " ": (t) => t.textMuted,
};

export function getFileStatus(file: GitStatusFile): string {
  return file.workingTreeStatus !== " " ? file.workingTreeStatus : file.indexStatus;
}

export function getStatusIcon(status: string): string {
  return STATUS_ICONS[status] ?? "·";
}

export function getStatusColor(status: string, theme: Theme): string {
  const colorFn = STATUS_COLORS[status] ?? STATUS_COLORS[" "];
  return colorFn?.(theme) ?? theme.textMuted;
}

export function splitPath(filePath: string): {
  name: string;
  dir: string | null;
} {
  const lastSlash = filePath.lastIndexOf("/");
  if (lastSlash === -1) {
    return { name: filePath, dir: null };
  }
  return {
    name: filePath.slice(lastSlash + 1),
    dir: filePath.slice(0, lastSlash),
  };
}

export function formatFilePath(filePath: string, maxDirLen = 18): string {
  const { name, dir } = splitPath(filePath);
  if (!dir) return name;
  return `${truncateDir(dir, maxDirLen)}/${name}`;
}

export function truncateDir(dir: string, maxLen: number): string {
  if (dir.length <= maxLen) return dir;
  const parts = dir.split("/").filter(Boolean);
  if (parts.length <= 2) return `…/${parts.at(-1) ?? dir.slice(-(maxLen - 1))}`;

  const first = parts[0] ?? "";
  const last = parts.at(-1) ?? "";

  if (first.length + last.length + 5 > maxLen) {
    return `…/${last}`;
  }

  return `${first}/…/${last}`;
}

/**
 * Returns all ancestor directory paths for a file path.
 * E.g. "src/components/ui/button.ts" → ["src", "src/components", "src/components/ui"]
 */
export function getAncestorDirs(filePath: string): string[] {
  const parts = filePath.split("/");
  const dirs: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    dirs.push(parts.slice(0, i).join("/"));
  }
  return dirs;
}

export function buildDirKey(section: FileSection, path: string): string {
  return buildFileKey(section, path);
}

function collectVisualFiles(nodes: FileTreeNode[], output: GitStatusFile[]): void {
  for (const node of nodes) {
    if (node.isDirectory) {
      collectVisualFiles(node.children, output);
    } else if (node.fileInfo) {
      output.push(node.fileInfo);
    }
  }
}

export function getVisualFileOrder(files: GitStatusFile[]): GitStatusFile[] {
  if (files.length === 0) return [];

  const root = buildFileTree(files);
  const ordered: GitStatusFile[] = [];
  collectVisualFiles(root.children, ordered);
  return ordered;
}
