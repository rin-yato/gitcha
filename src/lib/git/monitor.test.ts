import { expect, mock, test } from "bun:test";

test("uses chokidar when available", async () => {
  let allHandler: ((event: string, filePath: string) => void) | null = null;

  mock.module("chokidar", () => ({
    default: {
      watch: () => ({
        on(event: string, handler: (event: string, filePath: string) => void) {
          if (event === "all") allHandler = handler;
          return this;
        },
        close: async () => {},
      }),
    },
  }));

  const { createRepoMonitor } = await import("./monitor");

  const monitor = await createRepoMonitor(
    {
      root: "/work",
      cwd: "/work",
      backend: {} as never,
      toRootPath: (relativePath: string) => `/work/${relativePath}`,
      toRelativePath: (absolutePath: string) => absolutePath,
    },
    () => {},
  );

  expect(monitor).toBeDefined();
  expect(monitor.mode).toBe("native");

  allHandler?.("change", "/work/.git/index");
  await monitor.dispose();
});

test("falls back when fs.watch is unavailable", async () => {
  mock.module("chokidar", () => {
    return {
      default: {
        watch: () => {
          throw new Error("watch missing");
        },
      },
    };
  });

  const { createRepoMonitor } = await import("./monitor");

  const monitor = await createRepoMonitor(
    {
      root: "/work",
      cwd: "/work",
      backend: {} as never,
      toRootPath: (relativePath: string) => `/work/${relativePath}`,
      toRelativePath: (absolutePath: string) => absolutePath,
    },
    () => {},
  );

  expect(monitor.mode).toBe("polling");
  await monitor.dispose();
});
