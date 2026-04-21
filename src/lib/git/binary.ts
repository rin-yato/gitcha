import { isBinaryFileSync } from "isbinaryfile";

const UNSUPPORTED_EXTENSIONS = new Set([
  "png",
  "jpg",
  "jpeg",
  "gif",
  "ico",
  "webp",
  "bmp",
  "mp4",
  "mp3",
  "wav",
  "ogg",
  "webm",
  "avi",
  "mov",
  "mkv",
  "pdf",
  "zip",
  "tar",
  "gz",
  "rar",
  "7z",
  "exe",
  "dll",
  "so",
  "dylib",
  "bin",
  "dat",
]);

export const SAMPLE_BYTE_LIMIT = 4096;

export const BINARY_UNSUPPORTED_REASON = "Binary file - cannot display diff";

export function getUnsupportedReason(
  filePath: string,
  sample: Uint8Array | null,
): string | null {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext && UNSUPPORTED_EXTENSIONS.has(ext)) {
    return `Unsupported file type: .${ext}`;
  }

  if (!sample) return null;

  return isBinaryFileSync(Buffer.from(sample), { size: sample.length })
    ? BINARY_UNSUPPORTED_REASON
    : null;
}
