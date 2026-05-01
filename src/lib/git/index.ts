import { GitCache } from "./cache";
import { createGitCommands } from "./commands/index";
import { GitExecutor } from "./executor";
import type { GitClientOptions, GitExecutorLike } from "./types";

export class GitClient {
  readonly cwd?: string;
  readonly cache: GitCache;
  readonly executor: GitExecutorLike;
  readonly commands: ReturnType<typeof createGitCommands>;

  constructor(options: GitClientOptions = {}) {
    this.cwd = options.cwd;
    this.cache = options.cache ?? new GitCache();
    this.executor =
      options.executor ??
      new GitExecutor({
        binary: options.binary,
        maxConcurrency: options.maxConcurrency,
        timeoutMs: options.timeoutMs,
      });
    this.commands = createGitCommands({
      cwd: this.cwd,
      executor: this.executor,
      cache: this.cache,
    });
  }

  get repo() {
    return this.commands.repo;
  }

  get status() {
    return this.commands.status;
  }

  get branch() {
    return this.commands.branch;
  }

  get log() {
    return this.commands.log;
  }

  get diff() {
    return this.commands.diff;
  }

  invalidateCache(prefix?: string): void {
    this.cache.invalidate(prefix);
  }
}

const clientCache = new Map<string, GitClient>();

export function createGitClient(options: GitClientOptions | string = {}): GitClient {
  return new GitClient(typeof options === "string" ? { cwd: options } : options);
}

export function getGitClient(cwd?: string): GitClient {
  const key = cwd ?? process.cwd();
  const cached = clientCache.get(key);
  if (cached) return cached;

  const client = createGitClient({ cwd });
  clientCache.set(key, client);
  return client;
}

export * from "./binary";
export * from "./cache";
export * from "./commands";
export { createGitCommands } from "./commands/index";
export * from "./diff";
export * from "./errors";
export * from "./executor";
export * from "./files";
export * from "./parser";
export * from "./repo";
export * from "./types";
