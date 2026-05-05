import type { FsBackend } from "./types";

export const bunFs: FsBackend = {
  readFile: (path) =>
    Bun.file(path)
      .text()
      .catch(() => null),

  readFileSample: async (path, maxBytes) =>
    Bun.file(path)
      .slice(0, maxBytes)
      .arrayBuffer()
      .then((buffer) => new Uint8Array(buffer))
      .catch(() => null),

  exists: async (path) => {
    try {
      return await Bun.file(path).exists();
    } catch {
      return false;
    }
  },
};
