import { Result } from "better-result";

import { GitParseError } from "../errors";
import type { GitBranch, GitBranchScope, GitResult } from "../types";

export const BRANCH_LIST_FORMAT =
  "%x1e%(refname)%x00%(refname:short)%x00%(objectname)%x00%(upstream:short)%x00%(HEAD)%x00%(committerdate:iso-strict)%x00%(subject)%x00%(authorname)%x00%(authoremail)";

function normalizeAuthorEmail(value: string): string {
  return value.replace(/^</, "").replace(/>$/, "");
}

function branchScopeFromRef(ref: string): GitBranchScope | null {
  if (ref.startsWith("refs/heads/")) return "local";
  if (ref.startsWith("refs/remotes/")) return "remote";
  return null;
}

export function parseBranches(output: string): GitResult<GitBranch[]> {
  if (!output) return Result.ok([]);

  const branches: GitBranch[] = [];
  const records = output.split("\x1e").filter(Boolean);

  for (const record of records) {
    const normalizedRecord = record.replace(/^\n/, "").replace(/\n$/, "");
    const [
      ref,
      name,
      commitRef,
      upstream,
      currentMarker,
      committedAt,
      lastCommitTitle,
      authorName,
      authorEmail,
    ] = normalizedRecord.split("\0");

    if (
      ref === undefined ||
      name === undefined ||
      commitRef === undefined ||
      upstream === undefined ||
      currentMarker === undefined ||
      committedAt === undefined ||
      lastCommitTitle === undefined ||
      authorName === undefined ||
      authorEmail === undefined
    ) {
      return Result.err(
        new GitParseError({
          parser: "branch-list",
          message: "Malformed git branch record",
          output,
        }),
      );
    }

    const scope = branchScopeFromRef(ref);
    if (!scope || ref.endsWith("/HEAD")) continue;

    branches.push({
      ref,
      name,
      scope,
      current: currentMarker.trim() === "*",
      commitRef,
      upstream: upstream || undefined,
      committedAt: committedAt || undefined,
      lastCommitTitle: lastCommitTitle || undefined,
      authorName: authorName || undefined,
      authorEmail: authorEmail ? normalizeAuthorEmail(authorEmail) : undefined,
    });
  }

  return Result.ok(branches);
}
