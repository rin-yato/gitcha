import { execGit, isGitRepo } from "./commands";
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

/**
 * Build a hierarchical tree structure from flat file list
 */
export function buildFileTree(files: GitStatusFile[]): FileTreeNode {
  const root: FileTreeNode = {
    name: "",
    path: "",
    isDirectory: true,
    children: [],
  };

  for (const file of files) {
    const parts = file.path.split("/");
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const currentPath = parts.slice(0, i + 1).join("/");

      let child: FileTreeNode | undefined = current.children.find((c) => c.name === part);

      if (!child) {
        const newChild: FileTreeNode = {
          name: part,
          path: currentPath,
          isDirectory: !isLast,
          children: [],
          fileInfo: isLast ? file : undefined,
        };
        current.children.push(newChild);
        child = newChild;
      }

      current = child;
    }
  }

  // Sort: directories first, then alphabetically
  const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes
      .sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      })
      .map((node) => ({
        ...node,
        children: sortNodes(node.children),
      }));
  };

  root.children = sortNodes(root.children);
  return root;
}

/**
 * Get current branch and upstream info
 */
export async function getBranchInfo(cwd?: string): Promise<{
  branch: string;
  upstream?: string;
  ahead: number;
  behind: number;
}> {
  try {
    const branch = (await execGit(["rev-parse", "--abbrev-ref", "HEAD"], { cwd })).trim();

    let upstream: string | undefined;
    let ahead = 0;
    let behind = 0;

    try {
      const upstreamOutput = (
        await execGit(["rev-parse", "--abbrev-ref", "@{upstream}"], { cwd })
      ).trim();
      upstream = upstreamOutput;

      const countOutput = (
        await execGit(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], { cwd })
      ).trim();
      const [aheadStr, behindStr] = countOutput.split("\t") as [string, string];
      ahead = parseInt(aheadStr, 10) || 0;
      behind = parseInt(behindStr, 10) || 0;
    } catch {
      // No upstream configured
    }

    return { branch, upstream, ahead, behind };
  } catch {
    return { branch: "unknown", ahead: 0, behind: 0 };
  }
}

/**
 * Get complete repository status
 */
export async function getRepoStatus(cwd?: string): Promise<GitRepoStatus> {
  if (!(await isGitRepo(cwd))) {
    return {
      branch: "",
      aheadCount: 0,
      behindCount: 0,
      files: { staged: [], changes: [], untracked: [], conflicted: [] },
      totalFiles: 0,
      isRepo: false,
    };
  }

  const statusOutput = await execGit(["status", "--porcelain=v1", "--untracked-files=all"], {
    cwd,
  });
  const files: GitStatusFile[] = [];

  if (statusOutput) {
    const lines = statusOutput.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const parsed = parseStatusLine(line);
      if (parsed) {
        files.push(parsed);
      }
    }
  }

  const categorized = categorizeFiles(files);
  const branchInfo = await getBranchInfo(cwd);

  return {
    branch: branchInfo.branch,
    upstream: branchInfo.upstream,
    aheadCount: branchInfo.ahead,
    behindCount: branchInfo.behind,
    files: categorized,
    totalFiles: files.length,
    isRepo: true,
  };
}
