import { Result } from "better-result";

import { GitParseError } from "./errors";
import type {
  CategorizedFiles,
  FileTreeNode,
  FileTreeSnapshot,
  GitFileStatus,
  GitRepoStatus,
  GitResult,
  GitStatusFile,
  RecentCommitSummary,
} from "./types";

type DiffStatusLine = { path: string; originalPath?: string; status: string };

type ParsedStatusBranch = {
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

function parseStatusCode(value: string | undefined): GitFileStatus {
  return (value || " ") as GitFileStatus;
}

function isRenameOrCopy(indexStatus: GitFileStatus, workingTreeStatus: GitFileStatus): boolean {
  return (
    indexStatus === "R" ||
    indexStatus === "C" ||
    workingTreeStatus === "R" ||
    workingTreeStatus === "C"
  );
}

function normalizeOrigin(decorations: string): string {
  return (
    decorations
      .split(",")
      .map((entry) => entry.trim())
      .find(
        (entry) =>
          entry.length > 0 &&
          entry !== "HEAD" &&
          entry !== "tag:" &&
          !entry.startsWith("tag: "),
      )
      ?.replace(/^HEAD ->\s*/, "") ?? ""
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

export class GitStatusParser {
  parseStatusLine(line: string): GitStatusFile | null {
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

  parseDiffNameStatusLine(line: string): DiffStatusLine | null {
    if (!line || line.length < 2) return null;

    const status = line[0] ?? "";
    const rest = line.slice(1).trimStart();

    if (!rest) return null;

    if (status === "R" || status === "C") {
      const arrowIndex = rest.indexOf(" -> ");
      if (arrowIndex !== -1) {
        const originalPath = rest.slice(0, arrowIndex);
        const path = rest.slice(arrowIndex + 4);
        if (originalPath && path) return { path, originalPath, status };
      }

      const parts = rest.split("\t").filter(Boolean);
      if (parts.length >= 2) {
        const originalPath = parts[parts.length - 2]!;
        const path = parts[parts.length - 1]!;
        if (originalPath && path) return { path, originalPath, status };
      }
    }

    const path = rest.startsWith("\t") ? rest.slice(1) : rest;
    return { path, status: status || " " };
  }

  parseDiffNameStatus(output: string, nulTerminated = true): GitResult<DiffStatusLine[]> {
    if (!output) return Result.ok([]);

    if (!nulTerminated) {
      return Result.ok(
        output
          .split(/\r?\n/)
          .filter(Boolean)
          .map((line) => this.parseDiffNameStatusLine(line))
          .filter((entry): entry is DiffStatusLine => entry !== null),
      );
    }

    const records = output.split("\0").filter(Boolean);
    const files: DiffStatusLine[] = [];

    for (let index = 0; index < records.length; index += 1) {
      const status = records[index];
      if (!status) continue;

      const statusCode = status[0] ?? " ";
      if (statusCode === "R" || statusCode === "C") {
        const originalPath = records[index + 1];
        const path = records[index + 2];
        if (!originalPath || !path) {
          return Result.err(
            new GitParseError({
              parser: "diff-name-status",
              message: "Malformed rename/copy entry in git diff --name-status output",
              output,
            }),
          );
        }

        files.push({ path, originalPath, status: statusCode });
        index += 2;
        continue;
      }

      const path = records[index + 1];
      if (!path) {
        return Result.err(
          new GitParseError({
            parser: "diff-name-status",
            message: "Malformed file entry in git diff --name-status output",
            output,
          }),
        );
      }

      files.push({ path, status: statusCode });
      index += 1;
    }

    return Result.ok(files);
  }

  categorizeFiles(files: GitStatusFile[]): CategorizedFiles {
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

  parseStatusBranchLine(line: string): ParsedStatusBranch | null {
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

  parseRepoStatus(output: string, nulTerminated = true): GitResult<ParsedRepoStatus> {
    if (!nulTerminated) {
      return this.parseRepoStatusLines(output.split(/\r?\n/).filter(Boolean));
    }

    const records = output.split("\0").filter(Boolean);
    const branchLine = records.find((line) => line.startsWith("## "));
    const branchInfo = branchLine ? this.parseStatusBranchLine(branchLine) : null;
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

  parseRepoStatusLines(lines: string[]): GitResult<ParsedRepoStatus> {
    const branchLine = lines.find((line) => line.startsWith("## "));
    const branchInfo = branchLine ? this.parseStatusBranchLine(branchLine) : null;
    const files = lines
      .filter((line) => !line.startsWith("## "))
      .map((line) => this.parseStatusLine(line))
      .filter((parsed): parsed is GitStatusFile => parsed !== null);

    return Result.ok({
      branch: branchInfo?.branch ?? "",
      upstream: branchInfo?.upstream,
      aheadCount: branchInfo?.aheadCount ?? 0,
      behindCount: branchInfo?.behindCount ?? 0,
      files,
    });
  }

  toRepoStatus(parsedStatus: ParsedRepoStatus): GitRepoStatus {
    const categorized = this.categorizeFiles(parsedStatus.files);
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

  parseList(output: string): string[] {
    return output.split(/\r?\n/).filter(Boolean).sort();
  }

  parseCommitParent(output: string): string | null {
    return output.trim().split(/\r?\n/)[0]?.split(/\s+/)[1] ?? null;
  }

  parseRootCommit(output: string): string | null {
    return output.trim().split(/\r?\n/)[0] || null;
  }

  parseRecentCommitSummaries(output: string): RecentCommitSummary[] {
    if (!output) return [];

    return output
      .split("\x1e")
      .filter(Boolean)
      .map((record) => {
        const [ref = "", subject = "", decorations = ""] = record.split("\0");
        return {
          ref,
          shortRef: ref.slice(0, 7),
          message: subject.trim(),
          origin: normalizeOrigin(decorations),
        };
      })
      .filter((entry) => entry.ref.length > 0);
  }

  parseBinaryNumstat(output: string): boolean {
    const line = output.split(/\r?\n/).find((entry) => entry.length > 0);
    if (!line) return false;

    const parts = line.split("\t");
    return parts[0] === "-" && parts[1] === "-";
  }

  buildFileTree(files: GitStatusFile[]): FileTreeNode {
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

  collectFileTreeFiles(nodes: FileTreeNode[]): GitStatusFile[] {
    return nodes.flatMap((node) => {
      if (node.isDirectory) return this.collectFileTreeFiles(node.children);
      return node.fileInfo ? [node.fileInfo] : [];
    });
  }

  buildFileTreeSnapshot(files: GitStatusFile[]): FileTreeSnapshot {
    if (files.length === 0) return EMPTY_FILE_TREE_SNAPSHOT;

    const tree = this.buildFileTree(files);
    return {
      tree,
      orderedFiles: this.collectFileTreeFiles(tree.children),
    };
  }
}

export const gitStatusParser = new GitStatusParser();
