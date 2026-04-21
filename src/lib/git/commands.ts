import { gitExecutor } from "./executor";
import { gitStatusParser } from "./parser";
import type { CompareResolution, CompareTarget, GitFileStatus, GitStatusFile } from "./types";

const EMPTY_TREE_REF = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const FULL_DIFF_CONTEXT_LINES = 999_999;

type DiffSourceStrategy = {
  buildArgs: () => string[];
};

class StagedDiffStrategy implements DiffSourceStrategy {
  constructor(
    private readonly filePath: string,
    readonly _cwd?: string,
    private readonly isNewFile = false,
    private readonly contextLines = FULL_DIFF_CONTEXT_LINES,
  ) {}

  buildArgs(): string[] {
    if (this.isNewFile) {
      return [
        "diff",
        "--no-ext-diff",
        "--find-renames",
        `--unified=${this.contextLines}`,
        "--no-color",
        "--no-index",
        "/dev/null",
        this.filePath,
      ];
    }

    return [
      "diff",
      "--no-ext-diff",
      "--find-renames",
      `--unified=${this.contextLines}`,
      "--no-color",
      "--cached",
      "--",
      this.filePath,
    ];
  }
}

class WorkingTreeDiffStrategy implements DiffSourceStrategy {
  constructor(
    private readonly filePath: string,
    readonly _cwd?: string,
    private readonly isNewFile = false,
    private readonly contextLines = FULL_DIFF_CONTEXT_LINES,
  ) {}

  buildArgs(): string[] {
    if (this.isNewFile) {
      return [
        "diff",
        "--no-ext-diff",
        "--find-renames",
        `--unified=${this.contextLines}`,
        "--no-color",
        "--no-index",
        "/dev/null",
        this.filePath,
      ];
    }

    return [
      "diff",
      "--no-ext-diff",
      "--find-renames",
      `--unified=${this.contextLines}`,
      "--no-color",
      "--",
      this.filePath,
    ];
  }
}

class CompareDiffStrategy implements DiffSourceStrategy {
  constructor(
    private readonly filePath: string,
    private readonly baseRef: string,
    private readonly targetRef?: string | null,
    private readonly contextLines = FULL_DIFF_CONTEXT_LINES,
  ) {}

  buildArgs(): string[] {
    const range = this.targetRef
      ? `${this.baseRef}..${this.targetRef}`
      : `${this.baseRef}..HEAD`;

    return [
      "diff",
      "--no-ext-diff",
      "--find-renames",
      `--unified=${this.contextLines}`,
      "--no-color",
      range,
      "--",
      this.filePath,
    ];
  }
}

class GitStatusStrategy {
  constructor(private readonly cwd?: string) {}

  async getCurrentBranch(): Promise<string> {
    return (
      await gitExecutor.run(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: this.cwd })
    ).trim();
  }

  async getRootCommit(): Promise<string | null> {
    const output = (
      await gitExecutor.run(["rev-list", "--max-parents=0", "HEAD"], { cwd: this.cwd })
    ).trim();
    return output ? (output.split(/\r?\n/)[0] ?? null) : null;
  }

  async getCommitParent(commitRef: string): Promise<string | null> {
    const output = (
      await gitExecutor.run(["rev-list", "--parents", "-n", "1", commitRef], { cwd: this.cwd })
    ).trim();
    return output.split(/\r?\n/)[0]?.split(/\s+/)[1] ?? null;
  }

  async getMergeBase(baseRef: string): Promise<string> {
    try {
      return (await gitExecutor.run(["merge-base", baseRef, "HEAD"], { cwd: this.cwd })).trim();
    } catch {
      return baseRef;
    }
  }

  async getCurrentBranchUpstream(): Promise<string | null> {
    try {
      return (
        await gitExecutor.run(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"], {
          cwd: this.cwd,
        })
      ).trim();
    } catch {
      return null;
    }
  }

  getCwd(): string | undefined {
    return this.cwd;
  }
}

class GitDiffStrategy {
  constructor(private readonly cwd?: string) {}

  async isBinaryDiff(
    filePath: string,
    section: "staged" | "changes" | "compare",
    baseRef?: string,
    targetRef?: string,
  ): Promise<boolean> {
    try {
      const diffCmd =
        section === "staged"
          ? ["diff", "--numstat", "--cached", "--", filePath]
          : section === "changes"
            ? ["diff", "--numstat", "--", filePath]
            : baseRef && targetRef
              ? ["diff", "--numstat", `${baseRef}..${targetRef}`, "--", filePath]
              : baseRef
                ? ["diff", "--numstat", `${baseRef}..HEAD`, "--", filePath]
                : null;

      if (!diffCmd) return false;

      const output = await gitExecutor.run(diffCmd, { cwd: this.cwd });
      const line = output.split(/\r?\n/).find((entry) => entry.length > 0);
      if (!line) return false;
      const parts = line.split("\t");
      return parts[0] === "-" && parts[1] === "-";
    } catch {
      return false;
    }
  }

  async getFilePatch(
    filePath: string,
    options: {
      fromRef?: string;
      toRef?: string | null;
      staged?: boolean;
      contextLines?: number;
      isNewFile?: boolean;
    } = {},
  ): Promise<string | null> {
    const {
      fromRef,
      toRef,
      staged = false,
      contextLines = FULL_DIFF_CONTEXT_LINES,
      isNewFile = false,
    } = options;

    const strategy = staged
      ? new StagedDiffStrategy(filePath, this.cwd, isNewFile, contextLines)
      : fromRef
        ? new CompareDiffStrategy(filePath, fromRef, toRef, contextLines)
        : new WorkingTreeDiffStrategy(filePath, this.cwd, isNewFile, contextLines);

    return (
      (await gitExecutor.run(strategy.buildArgs(), { cwd: this.cwd }).catch(() => null)) || null
    );
  }

  async getFileVersion(ref: string, filePath: string): Promise<string | null> {
    try {
      return await gitExecutor.run(["show", `${ref}:${filePath}`], { cwd: this.cwd });
    } catch {
      return null;
    }
  }

  async getDiffFiles(baseRef: string, targetRef: string): Promise<GitStatusFile[]> {
    const output = await gitExecutor.run(["diff", "--name-status", baseRef, targetRef], {
      cwd: this.cwd,
    });

    if (!output) return [];

    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => parseStatusLineFromDiff(line))
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
      .map((entry) => ({
        path: entry.path,
        originalPath: entry.originalPath,
        indexStatus: " " as GitFileStatus,
        workingTreeStatus: entry.status as GitFileStatus,
      }));
  }
}

class CompareTargetStrategy {
  constructor(private readonly statusStrategy: GitStatusStrategy) {}

  async getCompareBranches(): Promise<string[]> {
    const output = await gitExecutor.run(
      ["for-each-ref", "--format=%(refname:short)", "refs/heads/", "refs/remotes/"],
      { cwd: this.statusStrategy.getCwd() },
    );

    return [
      ...new Set(
        output
          .split(/\r?\n/)
          .filter(Boolean)
          .filter((branch) => !branch.endsWith("/HEAD")),
      ),
    ].sort();
  }

  async searchCompareBranches(query: string): Promise<string[]> {
    const needle = query.trim().toLowerCase();
    const branches = await this.getCompareBranches();
    return needle
      ? branches.filter((branch) => branch.toLowerCase().includes(needle))
      : branches;
  }

  async getRecentCommits(limit = 12): Promise<string[]> {
    const output = await gitExecutor.run(
      ["log", "--oneline", "--decorate", "-n", String(limit)],
      {
        cwd: this.statusStrategy.getCwd(),
      },
    );
    return output.split(/\r?\n/).filter(Boolean);
  }

  async getRecentCommitSummaries(
    limit = 12,
  ): Promise<Array<{ ref: string; shortRef: string; message: string; origin: string }>> {
    const output = await gitExecutor.run(
      ["log", "--decorate=short", "--pretty=format:%H%x09%s%x09%D", "-n", String(limit)],
      { cwd: this.statusStrategy.getCwd() },
    );

    return output
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => {
        const [ref, subject = "", decorations = ""] = line.split("\t");
        const origin =
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
            ?.replace(/^HEAD ->\s*/, "") ?? "";

        return {
          ref: ref ?? "",
          shortRef: (ref ?? "").slice(0, 7),
          message: subject.trim(),
          origin,
        };
      })
      .filter((entry) => entry.ref.length > 0);
  }

  async searchCompareCommits(
    query: string,
    limit = 1000,
  ): Promise<Array<{ ref: string; shortRef: string; message: string; origin: string }>> {
    const needle = query.trim().toLowerCase();
    const commits = await this.getRecentCommitSummaries(limit);
    return needle
      ? commits.filter((commit) =>
          `${commit.ref} ${commit.shortRef} ${commit.message} ${commit.origin}`
            .toLowerCase()
            .includes(needle),
        )
      : commits;
  }

  async getCompareTarget(): Promise<CompareTarget | null> {
    const currentBranch = await this.statusStrategy.getCurrentBranch();
    const upstreamBranch = await this.statusStrategy.getCurrentBranchUpstream();
    if (upstreamBranch) {
      return { mode: "base-branch", ref: upstreamBranch, label: upstreamBranch };
    }

    const mergedOutput = await gitExecutor.run(
      [
        "for-each-ref",
        "--format=%(refname:short)",
        "--merged",
        "HEAD",
        "refs/heads/",
        "refs/remotes/",
      ],
      { cwd: this.statusStrategy.getCwd() },
    );
    const mergedBranches = mergedOutput
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((branch) => branch !== currentBranch)
      .filter((branch) => !branch.endsWith("/HEAD"))
      .sort();

    if (mergedBranches.length === 0) {
      const rootCommit = await this.statusStrategy.getRootCommit();
      return rootCommit ? { mode: "base-branch", ref: rootCommit, label: "root commit" } : null;
    }

    const distanceResults = await Promise.all(
      mergedBranches.map(async (branch) => ({
        branch,
        distance:
          Number(
            await gitExecutor.run(["rev-list", "--count", `${branch}..HEAD`], {
              cwd: this.statusStrategy.getCwd(),
            }),
          ) || Number.POSITIVE_INFINITY,
      })),
    );

    const best = distanceResults.reduce<{ branch: string; distance: number } | null>(
      (currentBest, candidate) =>
        !currentBest || candidate.distance < currentBest.distance ? candidate : currentBest,
      null,
    );

    if (best) {
      return { mode: "base-branch", ref: best.branch, label: best.branch };
    }

    const rootCommit = await this.statusStrategy.getRootCommit();
    if (rootCommit) {
      return { mode: "base-branch", ref: rootCommit, label: "root commit" };
    }

    return { mode: "base-branch", ref: mergedBranches[0]!, label: mergedBranches[0]! };
  }
}

function parseStatusLineFromDiff(
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

class GitCommandService {
  private readonly status: GitStatusStrategy;
  private readonly diff: GitDiffStrategy;
  private readonly compare: CompareTargetStrategy;

  constructor(private readonly cwd?: string) {
    this.status = new GitStatusStrategy(cwd);
    this.diff = new GitDiffStrategy(cwd);
    this.compare = new CompareTargetStrategy(this.status);
  }

  getRepoStatus(options?: { includeUntracked?: boolean }) {
    return gitStatusParser.getRepoStatus(this.cwd, options);
  }

  getLocalBranches() {
    return gitExecutor
      .run(["for-each-ref", "--format=%(refname:short)", "refs/heads/"], {
        cwd: this.cwd,
      })
      .then((output) => output.split(/\r?\n/).filter(Boolean).sort());
  }

  getCompareBranches() {
    return this.compare.getCompareBranches();
  }

  getCompareTarget() {
    return this.compare.getCompareTarget();
  }

  getBranchDiffFiles(baseRef: string) {
    return this.diff.getDiffFiles(baseRef, "HEAD");
  }

  getCommitDiffFiles(commitRef: string) {
    return this.status
      .getCommitParent(commitRef)
      .then((parentRef) => this.diff.getDiffFiles(parentRef ?? EMPTY_TREE_REF, commitRef));
  }

  getCommitParent(commitRef: string) {
    return this.status.getCommitParent(commitRef);
  }

  getRecentCommitSummaries(limit = 12) {
    return this.compare.getRecentCommitSummaries(limit);
  }

  searchCompareBranches(query: string) {
    return this.compare.searchCompareBranches(query);
  }

  searchCompareCommits(query: string, limit = 1000) {
    return this.compare.searchCompareCommits(query, limit);
  }

  getMergeBase(baseRef: string) {
    return this.status.getMergeBase(baseRef);
  }

  getCurrentBranch() {
    return this.status.getCurrentBranch();
  }

  getRootCommit() {
    return this.status.getRootCommit();
  }

  getFilePatch(filePath: string, options?: Parameters<GitDiffStrategy["getFilePatch"]>[1]) {
    return this.diff.getFilePatch(filePath, options);
  }

  getDiffFiles(baseRef: string, targetRef: string) {
    return this.diff.getDiffFiles(baseRef, targetRef);
  }

  getFileVersion(ref: string, filePath: string) {
    return this.diff.getFileVersion(ref, filePath);
  }

  isBinaryDiff(
    filePath: string,
    section: "staged" | "changes" | "compare",
    baseRef?: string,
    targetRef?: string,
  ) {
    return this.diff.isBinaryDiff(filePath, section, baseRef, targetRef);
  }
}

const serviceCache = new Map<string, GitCommandService>();

function getService(cwd?: string): GitCommandService {
  const key = cwd ?? process.cwd();
  const cached = serviceCache.get(key);
  if (cached) return cached;

  const nextService = new GitCommandService(cwd);
  serviceCache.set(key, nextService);
  return nextService;
}

export async function isBinaryDiff(
  filePath: string,
  section: "staged" | "changes" | "compare",
  baseRef?: string,
  targetRef?: string,
  cwd?: string,
): Promise<boolean> {
  return getService(cwd).isBinaryDiff(filePath, section, baseRef, targetRef);
}

export function execGit(
  args: string[],
  options: { cwd?: string; encoding?: BufferEncoding } = {},
) {
  return gitExecutor.run(args, options);
}

export function execGitWithInput(args: string[], input: string, cwd?: string) {
  return gitExecutor.runWithInput(args, input, cwd);
}

export function getRepoRoot(cwd?: string) {
  return gitExecutor.getRepoRoot(cwd);
}

export function isGitRepo(cwd?: string) {
  return gitExecutor.isGitRepo(cwd);
}

export function stageFile(filePath: string, cwd?: string) {
  return gitExecutor.stageFile(filePath, cwd);
}

export function unstageFile(filePath: string, cwd?: string) {
  return gitExecutor.unstageFile(filePath, cwd);
}

export function discardChanges(filePath: string, cwd?: string) {
  return gitExecutor.discardChanges(filePath, cwd);
}

export function commitChanges(message: string, cwd?: string) {
  return gitExecutor.commitChanges(message, cwd);
}

export function pushChanges(cwd?: string) {
  return gitExecutor.pushChanges(cwd);
}

export function pullChanges(cwd?: string) {
  return gitExecutor.pullChanges(cwd);
}

export function getFileVersion(ref: string, filePath: string, cwd?: string) {
  return gitExecutor.getFileVersion(ref, filePath, cwd);
}

export async function getFilePatch(
  filePath: string,
  options: {
    cwd?: string;
    fromRef?: string;
    toRef?: string | null;
    staged?: boolean;
    contextLines?: number;
    isNewFile?: boolean;
  } = {},
): Promise<string | null> {
  const service = getService(options.cwd);
  return service.getFilePatch(filePath, options);
}

export async function getRevisionDiffFiles(
  fromRef: string,
  toRef: string,
  cwd?: string,
): Promise<GitStatusFile[]> {
  return getService(cwd).getDiffFiles(fromRef, toRef);
}

export async function getMergeBase(baseRef: string, cwd?: string): Promise<string> {
  return getService(cwd).getMergeBase(baseRef);
}

export async function getCurrentBranch(cwd?: string): Promise<string> {
  return getService(cwd).getCurrentBranch();
}

export async function getRootCommit(cwd?: string): Promise<string | null> {
  return getService(cwd).getRootCommit();
}

export async function getCommitParent(commitRef: string, cwd?: string): Promise<string | null> {
  return getService(cwd).getCommitParent(commitRef);
}

export async function getLocalBranches(cwd?: string): Promise<string[]> {
  return getService(cwd).getLocalBranches();
}

export async function getCompareBranches(cwd?: string): Promise<string[]> {
  return getService(cwd).getCompareBranches();
}

export async function searchCompareBranches(query: string, cwd?: string): Promise<string[]> {
  return getService(cwd).searchCompareBranches(query);
}

export async function getRecentCommits(limit = 12, cwd?: string): Promise<string[]> {
  return getService(cwd)
    .getRecentCommitSummaries(limit)
    .then((entries) =>
      entries.map((entry) => `${entry.ref}\t${entry.message}\t${entry.origin}`),
    );
}

export async function getDiffFiles(
  baseRef: string,
  targetRef: string,
  cwd?: string,
): Promise<GitStatusFile[]> {
  return getService(cwd).getDiffFiles(baseRef, targetRef);
}

export async function getCommitDiffFiles(
  commitRef: string,
  cwd?: string,
): Promise<GitStatusFile[]> {
  return getService(cwd).getCommitDiffFiles(commitRef);
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
): Promise<Array<{ ref: string; shortRef: string; message: string; origin: string }>> {
  return getService(cwd).getRecentCommitSummaries(limit);
}

export async function searchCompareCommits(
  query: string,
  limit = 1000,
  cwd?: string,
): Promise<Array<{ ref: string; shortRef: string; message: string; origin: string }>> {
  return getService(cwd).searchCompareCommits(query, limit);
}

export async function getCompareTarget(cwd?: string): Promise<CompareTarget | null> {
  return getService(cwd).getCompareTarget();
}

export async function getBranchDiffFiles(
  baseBranch: string,
  cwd?: string,
): Promise<GitStatusFile[]> {
  const baseRef = await getMergeBase(baseBranch, cwd);
  return getRevisionDiffFiles(baseRef, "HEAD", cwd);
}

export async function createRepoMonitor(
  ctx: import("./repo").RepoContext,
  onChange: (kind: import("./types").RepoChangeKind) => void,
): Promise<import("./types").RepoMonitor> {
  const { createRepoMonitor: createMonitor } = await import("./monitor");
  return createMonitor(ctx, onChange);
}
