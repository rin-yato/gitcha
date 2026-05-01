import { Result } from "better-result";

import { GitCache } from "./cache";
import { createGitCommands } from "./commands/index";
import { EMPTY_REPO_STATUS } from "./commands/status";
import { formatGitError, type GitError } from "./errors";
import { gitExecutor } from "./executor";
import type {
  BinaryDiffSection,
  CompareResolution,
  CompareTarget,
  FilePatchOptions,
  GetRepoStatusOptions,
  GitRepoStatus,
  GitResult,
  GitStatusFile,
  RecentCommitSummary,
} from "./types";

type GitCommandSuite = ReturnType<typeof createGitCommands>;

const serviceCache = new Map<string, GitCommandSuite>();

function serviceKey(cwd?: string): string {
  return cwd ?? process.cwd();
}

function getCommands(cwd?: string): GitCommandSuite {
  const key = serviceKey(cwd);
  const cached = serviceCache.get(key);
  if (cached) return cached;

  const commands = createGitCommands({ cwd, executor: gitExecutor, cache: new GitCache() });
  serviceCache.set(key, commands);
  return commands;
}

function unwrap<T>(result: GitResult<T>): T {
  if (Result.isOk(result)) return result.value;
  throw new Error(formatGitError(result.error as GitError));
}

function fallback<T>(result: GitResult<T>, value: T): T {
  return Result.isOk(result) ? result.value : value;
}

export async function execGit(
  args: string[],
  options: { cwd?: string; encoding?: BufferEncoding } = {},
): Promise<string> {
  return unwrap(await gitExecutor.runText(args, options));
}

export async function execGitWithInput(
  args: string[],
  input: string,
  cwd?: string,
): Promise<string> {
  return unwrap(await gitExecutor.runWithInput(args, input, cwd));
}

export function execGitResult(args: string[], options: { cwd?: string } = {}) {
  return gitExecutor.runText(args, options);
}

export async function getRepoRoot(cwd?: string): Promise<string> {
  return unwrap(await getCommands(cwd).repo.getRepoRoot());
}

export async function isGitRepo(cwd?: string): Promise<boolean> {
  return fallback(await getCommands(cwd).repo.isGitRepo(), false);
}

export async function getRepoStatus(
  cwd?: string,
  options?: GetRepoStatusOptions,
): Promise<GitRepoStatus> {
  return fallback(await getCommands(cwd).status.getRepoStatus(options), EMPTY_REPO_STATUS);
}

export async function stageFile(filePath: string, cwd?: string): Promise<void> {
  return unwrap(await getCommands(cwd).repo.stageFile(filePath));
}

export async function unstageFile(filePath: string, cwd?: string): Promise<void> {
  return unwrap(await getCommands(cwd).repo.unstageFile(filePath));
}

export async function discardChanges(filePath: string, cwd?: string): Promise<void> {
  return unwrap(await getCommands(cwd).repo.discardChanges(filePath));
}

export async function commitChanges(message: string, cwd?: string): Promise<void> {
  return unwrap(await getCommands(cwd).repo.commitChanges(message));
}

export async function pushChanges(cwd?: string): Promise<void> {
  return unwrap(await getCommands(cwd).repo.pushChanges());
}

export async function pullChanges(cwd?: string): Promise<void> {
  return unwrap(await getCommands(cwd).repo.pullChanges());
}

export async function getFileVersion(
  ref: string,
  filePath: string,
  cwd?: string,
): Promise<string | null> {
  return fallback(await getCommands(cwd).diff.getFileVersion(ref, filePath), null);
}

export async function getFilePatch(
  filePath: string,
  options: FilePatchOptions & { cwd?: string } = {},
): Promise<string | null> {
  return fallback(await getCommands(options.cwd).diff.getFilePatch(filePath, options), null);
}

export async function getRevisionDiffFiles(
  fromRef: string,
  toRef: string,
  cwd?: string,
): Promise<GitStatusFile[]> {
  return fallback(await getCommands(cwd).diff.getDiffFiles(fromRef, toRef), []);
}

export async function getMergeBase(baseRef: string, cwd?: string): Promise<string> {
  return fallback(await getCommands(cwd).status.getMergeBase(baseRef), baseRef);
}

export async function getCurrentBranch(cwd?: string): Promise<string> {
  return fallback(await getCommands(cwd).status.getCurrentBranch(), "");
}

export async function getRootCommit(cwd?: string): Promise<string | null> {
  return fallback(await getCommands(cwd).log.getRootCommit(), null);
}

export async function getCommitParent(commitRef: string, cwd?: string): Promise<string | null> {
  return fallback(await getCommands(cwd).log.getCommitParent(commitRef), null);
}

export async function getLocalBranches(cwd?: string): Promise<string[]> {
  return fallback(await getCommands(cwd).branch.getLocalBranches(), []);
}

export async function getCompareBranches(cwd?: string): Promise<string[]> {
  return fallback(await getCommands(cwd).branch.getCompareBranches(), []);
}

export async function searchCompareBranches(query: string, cwd?: string): Promise<string[]> {
  return fallback(await getCommands(cwd).branch.searchCompareBranches(query), []);
}

export async function getRecentCommits(limit = 12, cwd?: string): Promise<string[]> {
  return fallback(await getCommands(cwd).log.getRecentCommits(limit), []);
}

export async function getDiffFiles(
  baseRef: string,
  targetRef: string,
  cwd?: string,
): Promise<GitStatusFile[]> {
  return getRevisionDiffFiles(baseRef, targetRef, cwd);
}

export async function getCommitDiffFiles(
  commitRef: string,
  cwd?: string,
): Promise<GitStatusFile[]> {
  return fallback(
    await getCommands(cwd).diff.getCommitDiffFiles(
      commitRef,
      getCommands(cwd).log.getCommitParent,
    ),
    [],
  );
}

export async function resolveCompareTarget(
  target: CompareTarget,
  cwd?: string,
): Promise<CompareResolution> {
  if (target.mode === "single-commit") {
    const baseRef = (await getCommitParent(target.ref, cwd)) ?? target.ref;
    return {
      baseRef,
      compareRef: target.ref,
      targetRef: target.ref,
      revisionRange: `${baseRef}..${target.ref}`,
      baseLabel: target.label,
    };
  }

  if (target.mode === "base-commit") {
    return {
      baseRef: target.ref,
      compareRef: target.ref,
      targetRef: null,
      revisionRange: `${target.ref}..HEAD`,
      baseLabel: target.label,
    };
  }

  const baseRef = await getMergeBase(target.ref, cwd);
  return {
    baseRef,
    compareRef: target.ref,
    targetRef: null,
    revisionRange: `${baseRef}..HEAD`,
    baseLabel: target.label,
  };
}

export async function getRecentCommitSummaries(
  limit = 12,
  cwd?: string,
): Promise<RecentCommitSummary[]> {
  return fallback(await getCommands(cwd).log.getRecentCommitSummaries(limit), []);
}

export async function searchCompareCommits(
  query: string,
  limit = 1000,
  cwd?: string,
): Promise<RecentCommitSummary[]> {
  return fallback(await getCommands(cwd).log.searchCompareCommits(query, limit), []);
}

export async function getCompareTarget(cwd?: string): Promise<CompareTarget | null> {
  return fallback(await getCommands(cwd).branch.getCompareTarget(), null);
}

export async function getBranchDiffFiles(
  baseBranch: string,
  cwd?: string,
): Promise<GitStatusFile[]> {
  const baseRef = await getMergeBase(baseBranch, cwd);
  return getRevisionDiffFiles(baseRef, "HEAD", cwd);
}

export async function isBinaryDiff(
  filePath: string,
  section: BinaryDiffSection,
  baseRef?: string,
  targetRef?: string,
  cwd?: string,
): Promise<boolean> {
  return fallback(
    await getCommands(cwd).diff.isBinaryDiff(filePath, section, baseRef, targetRef),
    false,
  );
}

export async function createRepoMonitor(
  ctx: import("./types").RepoContext,
  onChange: (kind: import("./types").RepoChangeKind) => void,
): Promise<import("./types").RepoMonitor> {
  const { createRepoMonitor: createMonitor } = await import("./monitor");
  return createMonitor(ctx, onChange);
}
