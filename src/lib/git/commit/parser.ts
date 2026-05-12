import { Result } from "better-result";

import { GitParseError } from "../errors";
import type { GitCommit, GitResult, RecentCommitSummary } from "../types";

function buildCommitMessage(title: string, description: string): string {
  return description ? `${title}\n\n${description}` : title;
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

export function parseCommitParent(output: string): string | null {
  return parseCommitParentRefs(output)[0] ?? null;
}

export function parseCommitParentRefs(output: string): string[] {
  const firstLine = output.trim().split(/\r?\n/)[0];
  if (!firstLine) return [];

  return firstLine.split(/\s+/).slice(1);
}

export function parseRootCommit(output: string): string | null {
  return output.trim().split(/\r?\n/)[0] || null;
}

export function parseRecentCommitSummaries(output: string): RecentCommitSummary[] {
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

export function parseCommits(output: string): GitResult<GitCommit[]> {
  if (!output) return Result.ok([]);

  const commits: GitCommit[] = [];
  const records = output.split("\x1e").filter(Boolean);

  for (const record of records) {
    const normalizedRecord = record.replace(/^\n/, "").replace(/\n$/, "");
    const [
      ref,
      shortRef,
      rawTitle,
      rawDescription,
      authorName,
      authorEmail,
      authoredAt,
      committedAt,
      rawParentRefs,
      rawDecorations,
    ] = normalizedRecord.split("\0");

    if (
      ref === undefined ||
      shortRef === undefined ||
      rawTitle === undefined ||
      rawDescription === undefined ||
      authorName === undefined ||
      authorEmail === undefined ||
      authoredAt === undefined ||
      committedAt === undefined ||
      rawParentRefs === undefined ||
      rawDecorations === undefined
    ) {
      return Result.err(
        new GitParseError({
          parser: "commit-log",
          message: "Malformed git log commit record",
          output,
        }),
      );
    }

    const title = rawTitle.trim();
    const description = rawDescription.trim();

    commits.push({
      ref,
      shortRef,
      title,
      description,
      message: buildCommitMessage(title, description),
      authorName,
      authorEmail,
      authoredAt,
      committedAt,
      parentRefs: rawParentRefs.trim() ? rawParentRefs.trim().split(/\s+/) : [],
      origin: normalizeOrigin(rawDecorations.trim()),
    });
  }

  return Result.ok(commits);
}
