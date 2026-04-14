import { groupBy } from "remeda";

import { execGit } from "./commands";
import type {
  CategorizedFiles,
  FileTreeNode,
  GitFileStatus,
  GitRepoStatus,
  GitStatusFile,
} from "./types";

/**
 * Parse git status --porcelain=v1 output
 * Format: XY <path> or XY <original_path> -> <path> for renamed files
 */
export function parseStatusLine(line: string): GitStatusFile | null {
  if (!line || line.length < 3) return null;

  const indexStatus = line[0] as GitFileStatus;
  const workingTreeStatus = line[1] as GitFileStatus;
  const rest = line.slice(3);

  // Handle renamed files: "R " "path1 -> path2"
  if (
    indexStatus === "R" ||
    indexStatus === "C" ||
    workingTreeStatus === "R" ||
    workingTreeStatus === "C"
  ) {
    const arrowIndex = rest.indexOf(" -> ");
    if (arrowIndex !== -1) {
      return {
        path: rest.slice(arrowIndex + 4),
        originalPath: rest.slice(0, arrowIndex),
        indexStatus,
        workingTreeStatus,
      };
    }
  }

  return {
    path: rest,
    indexStatus,
    workingTreeStatus,
  };
}

/**
 * Categorize files based on their status
 */
export function categorizeFiles(files: GitStatusFile[]): CategorizedFiles {
  const result: CategorizedFiles = {
    staged: [],
    changes: [],
    untracked: [],
    conflicted: [],
  };

  for (const file of files) {
    // Conflicted files (unmerged)
    if (
      file.indexStatus === "U" ||
      file.workingTreeStatus === "U" ||
      (file.indexStatus === "A" && file.workingTreeStatus === "A") ||
      (file.indexStatus === "D" && file.workingTreeStatus === "D")
    ) {
      result.conflicted.push(file);
      continue;
    }

    // Untracked files
    if (file.indexStatus === "?" || file.workingTreeStatus === "?") {
      result.untracked.push(file);
      continue;
    }

    // Staged files (changes in index)
    if (file.indexStatus !== " ") {
      result.staged.push(file);
    }

    // Working tree changes (not staged)
    if (file.workingTreeStatus !== " ") {
      result.changes.push(file);
    }
  }

  return result;
}

export type ParsedStatusBranch = {
  branch: string;
  upstream?: string;
  aheadCount: number;
  behindCount: number;
};

export function parseStatusBranchLine(line: string): ParsedStatusBranch | null {
  if (!line.startsWith("## ")) return null;

  const rest = line.slice(3);

  if (rest.startsWith("No commits yet on ")) {
    return {
      branch: rest.slice("No commits yet on ".length),
      aheadCount: 0,
      behindCount: 0,
    };
  }

  if (rest.startsWith("HEAD (no branch)")) {
    return {
      branch: "HEAD",
      aheadCount: 0,
      behindCount: 0,
    };
  }

  const countsStart = rest.indexOf(" [");
  const branchPart = countsStart === -1 ? rest : rest.slice(0, countsStart);
  const countsPart = countsStart === -1 ? "" : rest.slice(countsStart + 2, -1);

  const [branch, upstream] = branchPart.split("...", 2) as [string, string?];
  const aheadMatch = countsPart.match(/ahead (\d+)/);
  const behindMatch = countsPart.match(/behind (\d+)/);

  return {
    branch,
    upstream,
    aheadCount: aheadMatch ? Number(aheadMatch[1]) : 0,
    behindCount: behindMatch ? Number(behindMatch[1]) : 0,
  };
}

/**
 * Build a hierarchical tree structure from flat file list
 */
export function buildFileTree(files: GitStatusFile[]): FileTreeNode {
  type PathEntry = { parts: string[]; file: GitStatusFile };

  const buildNodes = (entries: PathEntry[], prefix: string[] = []): FileTreeNode[] => {
    const groups = groupBy(entries, (entry) => entry.parts[0] ?? "");

    return Object.entries(groups)
      .map(([name, groupedEntries]) => {
        const childEntries = groupedEntries.flatMap((entry) =>
          entry.parts.length > 1 ? [{ parts: entry.parts.slice(1), file: entry.file }] : [],
        );
        const pathParts = [...prefix, name];
        const fileInfo = groupedEntries.find((entry) => entry.parts.length === 1)?.file;

        return {
          name,
          path: pathParts.join("/"),
          isDirectory: childEntries.length > 0,
          fileInfo,
          children: buildNodes(childEntries, pathParts),
        } satisfies FileTreeNode;
      })
      .toSorted((left, right) => {
        if (left.isDirectory !== right.isDirectory) {
          return left.isDirectory ? -1 : 1;
        }

        return left.name.localeCompare(right.name);
      });
  };

  return {
    name: "",
    path: "",
    isDirectory: true,
    children: buildNodes(files.map((file) => ({ parts: file.path.split("/"), file }))),
  };
}

export type FileTreeSnapshot = {
  tree: FileTreeNode;
  orderedFiles: GitStatusFile[];
};

export function collectFileTreeFiles(nodes: FileTreeNode[]): GitStatusFile[] {
  return nodes.flatMap((node) => {
    if (node.isDirectory) {
      return collectFileTreeFiles(node.children);
    }

    return node.fileInfo ? [node.fileInfo] : [];
  });
}

export function buildFileTreeSnapshot(files: GitStatusFile[]): FileTreeSnapshot {
  const tree = buildFileTree(files);
  return {
    tree,
    orderedFiles: collectFileTreeFiles(tree.children),
  };
}

type ParsedRepoStatus = {
  branch: string;
  upstream?: string;
  aheadCount: number;
  behindCount: number;
  files: GitStatusFile[];
};

function parseRepoStatusLines(lines: string[]): ParsedRepoStatus {
  const branchLine = lines.find((line) => line.startsWith("## "));
  const branchInfo = branchLine ? parseStatusBranchLine(branchLine) : null;
  const files: GitStatusFile[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) continue;

    const parsed = parseStatusLine(line);
    if (parsed) files.push(parsed);
  }

  return {
    branch: branchInfo?.branch ?? "",
    upstream: branchInfo?.upstream,
    aheadCount: branchInfo?.aheadCount ?? 0,
    behindCount: branchInfo?.behindCount ?? 0,
    files,
  };
}

/**
 * Get complete repository status
 */
export async function getRepoStatus(cwd?: string): Promise<GitRepoStatus> {
  const emptyStatus: GitRepoStatus = {
    branch: "",
    upstream: undefined,
    aheadCount: 0,
    behindCount: 0,
    files: { staged: [], changes: [], untracked: [], conflicted: [] },
    totalFiles: 0,
    isRepo: false,
  };

  const statusOutput = await execGit(
    ["status", "--porcelain=v1", "--branch", "--untracked-files=all"],
    {
      cwd,
    },
  ).catch(() => null);

  if (statusOutput === null) {
    return emptyStatus;
  }

  const parsedStatus = parseRepoStatusLines(statusOutput.split(/\r?\n/).filter(Boolean));

  const categorized = categorizeFiles(parsedStatus.files);

  return {
    branch: parsedStatus.branch,
    upstream: parsedStatus.upstream,
    aheadCount: parsedStatus.aheadCount,
    behindCount: parsedStatus.behindCount,
    files: categorized,
    totalFiles: parsedStatus.files.length,
    isRepo: true,
  };
}
