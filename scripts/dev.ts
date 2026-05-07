import { type Subprocess, spawn } from "bun";

import { resolve } from "node:path";

import { watch } from "chokidar";

import { readFile } from "node:fs/promises";

const ROOT = resolve(import.meta.dir, "..");
const ENTRY = resolve(ROOT, "src/index.tsx");
const WATCH_TARGETS = [
  resolve(ROOT, "src"),
  resolve(ROOT, "scripts"),
  resolve(ROOT, "package.json"),
  resolve(ROOT, "bunfig.toml"),
  resolve(ROOT, ".gitignore"),
];

let child: Subprocess | null = null;
let isRestarting = false;
let timer: ReturnType<typeof setTimeout> | null = null;
let stopping = false;

function readGitignorePatterns(contents: string): string[] {
  return contents
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .flatMap((pattern) => {
      const normalized = pattern.startsWith("/") ? pattern.slice(1) : pattern;
      const base = normalized.replace(/\/*$/, "");

      if (!base) return [];

      if (base.includes("/")) {
        return [base, `**/${base}`];
      }

      return [base, `**/${base}`, `**/${base}/**`];
    });
}

async function loadIgnoredGlobs() {
  const contents = await readFile(resolve(ROOT, ".gitignore"), "utf8");
  return ["**/node_modules/**", "**/.git/**", ...readGitignorePatterns(contents)];
}

function stopChild() {
  if (!child) return;

  child.kill();
  child = null;
}

function start() {
  stopChild();

  isRestarting = false;

  const spawnedChild = spawn(["bun", "run", ENTRY], {
    env: { ...process.env, GITCHA_DEV: "1" },
    stdio: ["inherit", "inherit", "inherit"],
  });
  child = spawnedChild;

  spawnedChild.exited.then((exitCode) => {
    if (stopping || child !== spawnedChild) return;

    if (exitCode === 100 && !isRestarting) {
      isRestarting = true;
      start();
    }
  });
}

const ignoredGlobs = await loadIgnoredGlobs();

const watcher = watch(WATCH_TARGETS, {
  ignored: ignoredGlobs,
  ignoreInitial: true,
});

watcher.on("all", () => {
  if (stopping) return;

  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    isRestarting = true;
    start();
  }, 100);
});

async function shutdown(signal: NodeJS.Signals) {
  if (stopping) return;

  stopping = true;
  if (timer) clearTimeout(timer);

  await watcher.close();
  stopChild();
  process.exit(signal === "SIGINT" ? 0 : 1);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

start();
