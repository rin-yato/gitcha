import { Result } from "better-result";

import { GitParseError } from "../errors";
import type { GitResult, GitStatusFile } from "../types";

export type GitDiffStatusLine = { path: string; originalPath?: string; status: string };

import { parseStatusCode } from "../status-code";

export function parseNameStatusLine(line: string): GitDiffStatusLine | null {
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

export function parseNameStatus(
  output: string,
  nulTerminated = true,
): GitResult<GitDiffStatusLine[]> {
  if (!output) return Result.ok([]);

  if (!nulTerminated) {
    return Result.ok(
      output
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => parseNameStatusLine(line))
        .filter((entry): entry is GitDiffStatusLine => entry !== null),
    );
  }

  const records = output.split("\0").filter(Boolean);
  const files: GitDiffStatusLine[] = [];

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

export function toStatusFiles(entries: GitDiffStatusLine[]): GitStatusFile[] {
  return entries.map((entry) => ({
    path: entry.path,
    originalPath: entry.originalPath,
    indexStatus: " ",
    workingTreeStatus: parseStatusCode(entry.status[0]),
  }));
}

export function parseBinaryNumstat(output: string): boolean {
  const line = output.split(/\r?\n/).find((entry) => entry.length > 0);
  if (!line) return false;

  const parts = line.split("\t");
  return parts[0] === "-" && parts[1] === "-";
}
