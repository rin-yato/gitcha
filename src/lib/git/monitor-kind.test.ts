import { expect, mock, test } from "bun:test";

test("monitor emits content and metadata events", async () => {
  let onAll: (event: string, filePath: string) => void = () => {};

  mock.module("chokidar", () => ({
    default: {
      watch: () => ({
        on(event: string, handler: (event: string, filePath: string) => void) {
          if (event === "all") onAll = handler;
          return this;
        },
        close: async () => {},
      }),
    },
  }));

  const { createRepoMonitor } = await import("./monitor");

  const kinds: string[] = [];
  const monitor = await createRepoMonitor(
    {
      root: "/work",
      cwd: "/work",
      backend: {} as never,
      toRootPath: (relativePath: string) => `/work/${relativePath}`,
      toRelativePath: (absolutePath: string) => absolutePath,
    },
    (kind) => {
      kinds.push(kind);
    },
  );

  expect(monitor.mode).toBe("native");

  onAll("change", "/work/file.ts");
  onAll("change", "/work/.git/index");

  await new Promise((resolve) => setTimeout(resolve, 150));

  expect(kinds).toContain("content");
  expect(kinds).toContain("metadata");

  await monitor.dispose();
});
