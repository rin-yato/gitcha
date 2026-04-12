import type { FsBackend } from "./types";

export const bunFs: FsBackend = {
  readFile: (path) =>
    Bun.file(path)
      .text()
      .catch(() => null),

  exists: async (path) => {
    try {
      return await Bun.file(path).exists();
    } catch {
      return false;
    }
  },
};
