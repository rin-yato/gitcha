import { getFilePatch } from "./commands";
import type { RepoContext } from "./repo";
import type { CompareMode, FileDiffSource, GitStatusFile } from "./types";

type DiffFileStrategy = {
  getPatch: () => Promise<string | null>;
};

class StagedFileStrategy implements DiffFileStrategy {
  constructor(
    private readonly ctx: RepoContext,
    private readonly file: GitStatusFile,
  ) {}

  getPatch(): Promise<string | null> {
    return getFilePatch(this.file.path, {
      cwd: this.ctx.cwd,
      staged: true,
      isNewFile: this.file.indexStatus === "?" || this.file.workingTreeStatus === "?",
    });
  }
}

class WorkingTreeFileStrategy implements DiffFileStrategy {
  constructor(
    private readonly ctx: RepoContext,
    private readonly file: GitStatusFile,
  ) {}

  getPatch(): Promise<string | null> {
    return getFilePatch(this.file.path, {
      cwd: this.ctx.cwd,
      isNewFile: this.file.indexStatus === "?" || this.file.workingTreeStatus === "?",
    });
  }
}

class CompareFileStrategy implements DiffFileStrategy {
  constructor(
    private readonly ctx: RepoContext,
    private readonly file: GitStatusFile,
    private readonly compareBaseRef: string,
    private readonly compareTargetRef?: string | null,
    private readonly compareMode?: CompareMode,
  ) {}

  getPatch(): Promise<string | null> {
    return getFilePatch(this.file.path, {
      cwd: this.ctx.cwd,
      fromRef: this.compareBaseRef,
      toRef: this.compareTargetRef ?? undefined,
      isNewFile:
        this.compareMode === "single-commit" &&
        (this.file.indexStatus === "?" || this.file.workingTreeStatus === "?"),
    });
  }
}

export async function loadFileDiffSource(args: {
  ctx: RepoContext;
  file: GitStatusFile;
  section: "staged" | "changes" | "compare";
  compareBaseRef?: string;
  compareTargetRef?: string | null;
  compareMode?: CompareMode;
}): Promise<FileDiffSource> {
  const { ctx, file, section, compareBaseRef, compareTargetRef, compareMode } = args;

  const strategy =
    section === "staged"
      ? new StagedFileStrategy(ctx, file)
      : section === "compare" && compareBaseRef
        ? new CompareFileStrategy(ctx, file, compareBaseRef, compareTargetRef, compareMode)
        : new WorkingTreeFileStrategy(ctx, file);

  const patch = await strategy.getPatch();

  return {
    patch: patch ?? "",
    originalPath: file.originalPath,
  };
}
