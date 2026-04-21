import { groupBy } from "remeda";

import { gitExecutor } from "./executor";
import type {
  CategorizedFiles,
  FileTreeNode,
  GitFileStatus,
  GitRepoStatus,
  GitStatusFile,
} from "./types";

type GetRepoStatusOptions = {
  includeUntracked?: boolean;
};

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
 * Parse "XY path" output from `git diff --name-status`.
 */
export function parseDiffNameStatusLine(
  line: string,
): { path: string; originalPath?: string; status: string } | null {
  if (!line || line.length < 2) return null;

  const status = line[0] ?? "";
  const rest = line.slice(1).trimStart();

  if (!rest) return null;

  if (status === "R" || status === "C") {
    const arrowIndex = rest.indexOf(" -> ");
    if (arrowIndex !== -1) {
      const originalPath = rest.slice(0, arrowIndex);
      const path = rest.slice(arrowIndex + 4);
      if (originalPath && path) {
        return { path, originalPath, status };
      }
    }

    const parts = rest.split("\t").filter(Boolean);
    if (parts.length >= 2) {
      const originalPath = parts[parts.length - 2]!;
      const path = parts[parts.length - 1]!;
      if (originalPath && path) {
        return { path, originalPath, status };
      }
    }
  }

  const path = rest.startsWith("\t") ? rest.slice(1) : rest;
  return { path, status: status || " " };
}

/**
 * Categorize files based on their status
 */
export function categorizeFiles(files: GitStatusFile[]): CategorizedFiles {
  const isConflicted = (file: GitStatusFile) =>
    file.indexStatus === "U" ||
    file.workingTreeStatus === "U" ||
    (file.indexStatus === "A" && file.workingTreeStatus === "A") ||
    (file.indexStatus === "D" && file.workingTreeStatus === "D");

  const isUntracked = (file: GitStatusFile) =>
    file.indexStatus === "?" || file.workingTreeStatus === "?";
  const isStaged = (file: GitStatusFile) =>
    file.indexStatus !== " " && !isConflicted(file) && !isUntracked(file);
  const isChanged = (file: GitStatusFile) =>
    file.workingTreeStatus !== " " && !isConflicted(file) && !isUntracked(file);

  return {
    conflicted: files.filter(isConflicted),
    untracked: files.filter(isUntracked),
    staged: files.filter(isStaged),
    changes: files.filter(isChanged),
  };
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
  if (files.length === 0) {
    return EMPTY_FILE_TREE_SNAPSHOT;
  }

  const tree = buildFileTree(files);
  return {
    tree,
    orderedFiles: collectFileTreeFiles(tree.children),
  };
}

const EMPTY_FILE_TREE_SNAPSHOT: FileTreeSnapshot = {
  tree: {
    name: "",
    path: "",
    isDirectory: true,
    children: [],
  },
  orderedFiles: [],
};

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
  const files = lines
    .filter((line) => !line.startsWith("## "))
    .map(parseStatusLine)
    .filter((parsed): parsed is GitStatusFile => parsed !== null);

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
export async function getRepoStatus(
  cwd?: string,
  options: GetRepoStatusOptions = {},
): Promise<GitRepoStatus> {
  const emptyStatus: GitRepoStatus = {
    branch: "",
    upstream: undefined,
    aheadCount: 0,
    behindCount: 0,
    files: { staged: [], changes: [], untracked: [], conflicted: [] },
    totalFiles: 0,
    isRepo: false,
  };

  const includeUntracked = options.includeUntracked ?? true;
  const statusOutput = await gitExecutor
    .run(
      [
        "status",
        "--porcelain=v1",
        "--branch",
        `--untracked-files=${includeUntracked ? "all" : "no"}`,
      ],
      {
        cwd,
      },
    )
    .catch(() => null);

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
