import { getFilePatch } from "./commands";
import type {
  BinaryDiffSection,
  CompareMode,
  FileDiffSource,
  GitStatusFile,
  RepoContext,
} from "./types";

export async function loadFileDiffSource(args: {
  ctx: RepoContext;
  file: GitStatusFile;
  section: BinaryDiffSection;
  compareBaseRef?: string;
  compareTargetRef?: string | null;
  compareMode?: CompareMode;
  repoRoot?: string;
}): Promise<FileDiffSource> {
  const { ctx, file, section, compareBaseRef, compareTargetRef, compareMode, repoRoot } = args;
  const isNewFile = file.indexStatus === "?" || file.workingTreeStatus === "?";
  const patch = await getFilePatch(file.path, {
    cwd: ctx.cwd,
    repoRoot: repoRoot ?? ctx.root,
    staged: section === "staged",
    fromRef: section === "compare" ? compareBaseRef : undefined,
    toRef: section === "compare" ? compareTargetRef : undefined,
    isNewFile: section !== "compare" ? isNewFile : compareMode === "single-commit" && isNewFile,
  });

  return {
    patch: patch ?? "",
    originalPath: file.originalPath,
  };
}
