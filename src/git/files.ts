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
  const [baseContent, indexContent] = await Promise.all([
    getFileVersion("HEAD", file.path, ctx.cwd),
    getFileVersion(":0", file.path, ctx.cwd),
  ]);
  return { baseContent, currentContent: indexContent };
}

export async function loadChangesDiffSource(
  ctx: RepoContext,
  file: GitStatusFile,
): Promise<FileDiffSource> {
  const [indexContent, workingContent] = await Promise.all([
    getFileVersion(":0", file.path, ctx.cwd),
    readWorkingFile(ctx, file.path),
  ]);
  return { baseContent: indexContent, currentContent: workingContent };
}

export async function loadCompareDiffSource(
  ctx: RepoContext,
  file: GitStatusFile,
  baseRef: string,
): Promise<FileDiffSource> {
  const [baseContent, currentContent] = await Promise.all([
    getFileVersion(baseRef, file.path, ctx.cwd),
    readWorkingFile(ctx, file.path),
  ]);
  return { baseContent, currentContent };
}
