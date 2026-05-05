import { Result } from "better-result";

import { gitStatusParser } from "../parser";
import type {
  BinaryDiffSection,
  CompareMode,
  FileDiffSource,
  FilePatchOptions,
  GitCommandDependencies,
  GitFileStatus,
  GitResult,
  GitStatusFile,
  RepoContext,
} from "../types";

export const EMPTY_TREE_REF = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
export const DEFAULT_DIFF_CONTEXT_LINES = 999_999;

type DiffDependencies = {
  getRepoRoot: () => Promise<GitResult<string>>;
};

function revisionRange(fromRef: string, toRef?: string | null): string {
  return toRef ? `${fromRef}..${toRef}` : `${fromRef}..HEAD`;
}

function patchArgs(
  filePath: string,
  options: Required<Pick<FilePatchOptions, "contextLines">> & FilePatchOptions,
) {
  const base = [
    "diff",
    "--no-ext-diff",
    "--find-renames",
    `--unified=${options.contextLines}`,
    "--no-color",
  ];

  if (options.isNewFile) {
    return [...base, "--no-index", "/dev/null", filePath];
  }

  if (options.staged) {
    return [...base, "--cached", "--", filePath];
  }

  if (options.fromRef) {
    return [...base, revisionRange(options.fromRef, options.toRef), "--", filePath];
  }

  return [...base, "--", filePath];
}

function diffNumstatArgs(
  filePath: string,
  section: BinaryDiffSection,
  baseRef?: string,
  targetRef?: string,
): string[] | null {
  if (section === "staged") return ["diff", "--numstat", "--cached", "--", filePath];
  if (section === "changes") return ["diff", "--numstat", "--", filePath];
  if (baseRef) return ["diff", "--numstat", revisionRange(baseRef, targetRef), "--", filePath];
  return null;
}

function diffFileStatus(entry: {
  path: string;
  originalPath?: string;
  status: string;
}): GitStatusFile {
  return {
    path: entry.path,
    originalPath: entry.originalPath,
    indexStatus: " " as GitFileStatus,
    workingTreeStatus: (entry.status[0] ?? " ") as GitFileStatus,
  };
}

export function createDiffCommands(deps: GitCommandDependencies, diffDeps: DiffDependencies) {
  const cwd = deps.cwd;

  const getResolvedRepoRoot = async (repoRoot?: string): Promise<GitResult<string>> => {
    if (repoRoot) return Result.ok(repoRoot);
    return diffDeps.getRepoRoot();
  };

  const getFilePatch = async (
    filePath: string,
    options: FilePatchOptions = {},
  ): Promise<GitResult<string | null>> => {
    const contextLines = options.contextLines ?? DEFAULT_DIFF_CONTEXT_LINES;
    const repoRoot = await getResolvedRepoRoot(options.repoRoot);
    if (Result.isError(repoRoot)) return repoRoot.map(() => null);

    const output = await deps.executor.runText(
      patchArgs(filePath, { ...options, contextLines }),
      {
        cwd: repoRoot.value,
        successExitCodes: [0, 1],
        dedupe: true,
      },
    );
    if (Result.isError(output)) return output.map(() => null);

    return Result.ok(output.value || null);
  };

  return {
    getFilePatch,

    getFileVersion: async (
      ref: string,
      filePath: string,
    ): Promise<GitResult<string | null>> => {
      const repoRoot = await diffDeps.getRepoRoot();
      if (Result.isError(repoRoot)) return repoRoot.map(() => null);

      const output = await deps.executor.runText(["show", `${ref}:${filePath}`], {
        cwd: repoRoot.value,
        dedupe: true,
      });
      if (Result.isError(output)) return Result.ok(null);

      return Result.ok(output.value);
    },

    getDiffFiles: async (
      baseRef: string,
      targetRef: string,
    ): Promise<GitResult<GitStatusFile[]>> => {
      const output = await deps.executor.runText(
        ["diff", "--name-status", "-z", "--find-renames", baseRef, targetRef],
        { cwd, dedupe: true },
      );
      if (Result.isError(output)) return output;

      return gitStatusParser
        .parseDiffNameStatus(output.value, true)
        .map((entries) => entries.map(diffFileStatus));
    },

    getCommitDiffFiles: async (
      commitRef: string,
      getCommitParent: (commitRef: string) => Promise<GitResult<string | null>>,
    ): Promise<GitResult<GitStatusFile[]>> => {
      const parent = await getCommitParent(commitRef);
      if (Result.isError(parent)) return parent.map(() => []);

      const fromRef = parent.value ?? EMPTY_TREE_REF;
      const output = await deps.executor.runText(
        ["diff", "--name-status", "-z", "--find-renames", fromRef, commitRef],
        { cwd, dedupe: true },
      );
      if (Result.isError(output)) return output;

      return gitStatusParser
        .parseDiffNameStatus(output.value, true)
        .map((entries) => entries.map(diffFileStatus));
    },

    isBinaryDiff: async (
      filePath: string,
      section: BinaryDiffSection,
      baseRef?: string,
      targetRef?: string,
    ): Promise<GitResult<boolean>> => {
      const repoRoot = await diffDeps.getRepoRoot();
      if (Result.isError(repoRoot)) return repoRoot.map(() => false);

      const args = diffNumstatArgs(filePath, section, baseRef, targetRef);
      if (!args) return Result.ok(false);

      const output = await deps.executor.runText(args, { cwd: repoRoot.value, dedupe: true });
      if (Result.isError(output)) return output.map(() => false);

      return Result.ok(gitStatusParser.parseBinaryNumstat(output.value));
    },
  };
}

export async function loadFileDiffSource(args: {
  ctx: RepoContext;
  file: GitStatusFile;
  section: BinaryDiffSection;
  compareBaseRef?: string;
  compareTargetRef?: string | null;
  compareMode?: CompareMode;
  repoRoot?: string;
  getFilePatch: (
    filePath: string,
    options?: FilePatchOptions,
  ) => Promise<GitResult<string | null>>;
}): Promise<GitResult<FileDiffSource>> {
  const { ctx, file, section, compareBaseRef, compareTargetRef, compareMode, repoRoot } = args;
  const isNewFile = file.indexStatus === "?" || file.workingTreeStatus === "?";
  const patch = await args.getFilePatch(file.path, {
    repoRoot: repoRoot ?? ctx.root,
    staged: section === "staged",
    fromRef: section === "compare" ? compareBaseRef : undefined,
    toRef: section === "compare" ? compareTargetRef : undefined,
    isNewFile: section !== "compare" ? isNewFile : compareMode === "single-commit" && isNewFile,
  });
  if (Result.isError(patch)) return patch.map(() => ({ patch: "" }));

  return Result.ok({
    patch: patch.value ?? "",
    originalPath: file.originalPath,
  });
}
