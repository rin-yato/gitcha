import { getFileVersion } from "./commands";
import type { RepoContext } from "./repo";
import type { FileDiffSource, GitStatusFile } from "./types";

export async function readWorkingFile(
  ctx: RepoContext,
  filePath: string,
): Promise<string | null> {
  return ctx.backend.readFile(ctx.toRootPath(filePath));
}

export async function fileExists(ctx: RepoContext, filePath: string): Promise<boolean> {
  return ctx.backend.exists(ctx.toRootPath(filePath));
}

export async function loadStagedDiffSource(
  ctx: RepoContext,
  file: GitStatusFile,
): Promise<FileDiffSource> {
  const basePath = file.originalPath ?? file.path;
  const [baseContent, indexContent] = await Promise.all([
    getFileVersion("HEAD", basePath, ctx.cwd),
    getFileVersion(":0", file.path, ctx.cwd),
  ]);
  return { baseContent, currentContent: indexContent, originalPath: file.originalPath };
}

export async function loadChangesDiffSource(
  ctx: RepoContext,
  file: GitStatusFile,
): Promise<FileDiffSource> {
  const basePath = file.originalPath ?? file.path;
  const [indexContent, workingContent] = await Promise.all([
    getFileVersion(":0", basePath, ctx.cwd),
    readWorkingFile(ctx, file.path),
  ]);
  return {
    baseContent: indexContent,
    currentContent: workingContent,
    originalPath: file.originalPath,
  };
}

export async function loadCompareDiffSource(
  ctx: RepoContext,
  file: GitStatusFile,
  baseRef: string,
): Promise<FileDiffSource> {
  const basePath = file.originalPath ?? file.path;
  const [baseContent, currentContent] = await Promise.all([
    getFileVersion(baseRef, basePath, ctx.cwd),
    readWorkingFile(ctx, file.path),
  ]);
  return { baseContent, currentContent, originalPath: file.originalPath };
}
