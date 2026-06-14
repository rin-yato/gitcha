import { Result } from "better-result";

import { GitParseError } from "../errors";
import type {
  CategorizedFiles,
  FileTreeNode,
  FileTreeSnapshot,
  GitFileStatus,
  GitRepoStatus,
  GitResult,
  GitStatusFile,
} from "../types";

export type ParsedStatusBranch = {
  branch: string;
  upstream?: string;
  aheadCount: number;
  behindCount: number;
};

export type ParsedRepoStatus = {
  branch: string;
  upstream?: string;
  aheadCount: number;
  behindCount: number;
  files: GitStatusFile[];
};

const EMPTY_FILE_TREE_SNAPSHOT: FileTreeSnapshot = {
  tree: {
    name: "",
    path: "",
    isDirectory: true,
    children: [],
  },
  orderedFiles: [],
};

import { parseStatusCode } from "../status-code";

function isRenameOrCopy(indexStatus: GitFileStatus, workingTreeStatus: GitFileStatus): boolean {
  return (
    indexStatus === "R" ||
    indexStatus === "C" ||
    workingTreeStatus === "R" ||
    workingTreeStatus === "C"
  );
}

type MutableTreeNode = FileTreeNode & {
  childMap: Map<string, MutableTreeNode>;
};

function createMutableNode(name: string, path: string, isDirectory: boolean): MutableTreeNode {
  return { name, path, isDirectory, children: [], childMap: new Map() };
}

function finalizeTreeNode(node: MutableTreeNode): FileTreeNode {
  const children = [...node.childMap.values()]
    .sort((left, right) => {
      if (left.isDirectory !== right.isDirectory) return left.isDirectory ? -1 : 1;
      return left.name.localeCompare(right.name);
    })
    .map(finalizeTreeNode);

  return {
    name: node.name,
    path: node.path,
    isDirectory: node.isDirectory,
    children,
    fileInfo: node.fileInfo,
  };
}

export function parseStatusLine(line: string): GitStatusFile | null {
  if (!line || line.length < 3) return null;

  const indexStatus = parseStatusCode(line[0]);
  const workingTreeStatus = parseStatusCode(line[1]);
  const rest = line.slice(3);

  if (isRenameOrCopy(indexStatus, workingTreeStatus)) {
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

export function parseRepoStatus(
  output: string,
  nulTerminated = true,
): GitResult<ParsedRepoStatus> {
  if (!nulTerminated) {
    return parseRepoStatusLines(output.split(/\r?\n/).filter(Boolean));
  }

  const records = output.split("\0").filter(Boolean);
  const branchLine = records.find((line) => line.startsWith("## "));
  const branchInfo = branchLine ? parseStatusBranchLine(branchLine) : null;
  const files: GitStatusFile[] = [];

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record || record.startsWith("## ")) continue;
    if (record.length < 3) {
      return Result.err(
        new GitParseError({
          parser: "status",
          message: "Malformed git status record",
          output,
        }),
      );
    }

    const indexStatus = parseStatusCode(record[0]);
    const workingTreeStatus = parseStatusCode(record[1]);
    const path = record.slice(3);

    if (isRenameOrCopy(indexStatus, workingTreeStatus)) {
      const originalPath = records[index + 1];
      if (!originalPath) {
        return Result.err(
          new GitParseError({
            parser: "status",
            message: "Malformed rename/copy entry in git status output",
            output,
          }),
        );
      }

      files.push({ path, originalPath, indexStatus, workingTreeStatus });
      index += 1;
      continue;
    }

    files.push({ path, indexStatus, workingTreeStatus });
  }

  return Result.ok({
    branch: branchInfo?.branch ?? "",
    upstream: branchInfo?.upstream,
    aheadCount: branchInfo?.aheadCount ?? 0,
    behindCount: branchInfo?.behindCount ?? 0,
    files,
  });
}

export function parseRepoStatusLines(lines: string[]): GitResult<ParsedRepoStatus> {
  const branchLine = lines.find((line) => line.startsWith("## "));
  const branchInfo = branchLine ? parseStatusBranchLine(branchLine) : null;
  const files = lines
    .filter((line) => !line.startsWith("## "))
    .map((line) => parseStatusLine(line))
    .filter((parsed): parsed is GitStatusFile => parsed !== null);

  return Result.ok({
    branch: branchInfo?.branch ?? "",
    upstream: branchInfo?.upstream,
    aheadCount: branchInfo?.aheadCount ?? 0,
    behindCount: branchInfo?.behindCount ?? 0,
    files,
  });
}

export function toRepoStatus(parsedStatus: ParsedRepoStatus): GitRepoStatus {
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

export function parseNulList(output: string): string[] {
  return output.split("\0").filter(Boolean).sort();
}

export function buildFileTree(files: GitStatusFile[]): FileTreeNode {
  const root = createMutableNode("", "", true);

  for (const file of files) {
    const parts = file.path.split("/").filter(Boolean);
    let node = root;

    for (let index = 0; index < parts.length; index += 1) {
      const name = parts[index]!;
      const path = parts.slice(0, index + 1).join("/");
      const isLeaf = index === parts.length - 1;
      let child = node.childMap.get(name);

      if (!child) {
        child = createMutableNode(name, path, !isLeaf);
        node.childMap.set(name, child);
      }

      if (isLeaf && !child.fileInfo) {
        child.isDirectory = child.childMap.size > 0;
        child.fileInfo = file;
      }

      node = child;
    }
  }

  return finalizeTreeNode(root);
}

export function collectFileTreeFiles(nodes: FileTreeNode[]): GitStatusFile[] {
  return nodes.flatMap((node) => {
    if (node.isDirectory) return collectFileTreeFiles(node.children);
    return node.fileInfo ? [node.fileInfo] : [];
  });
}

export function buildFileTreeSnapshot(files: GitStatusFile[]): FileTreeSnapshot {
  if (files.length === 0) return EMPTY_FILE_TREE_SNAPSHOT;

  const tree = buildFileTree(files);
  return {
    tree,
    orderedFiles: collectFileTreeFiles(tree.children),
  };
}
