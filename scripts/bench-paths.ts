import os from "node:os";
import path from "node:path";

const cacheHome =
  process.env.XDG_CACHE_HOME ??
  (process.platform === "darwin"
    ? path.join(os.homedir(), "Library", "Caches")
    : path.join(os.homedir(), ".cache"));

export const BENCHMARK_CACHE_ROOT = path.join(cacheHome, "changes", "benchmarks");
export const BENCHMARK_REPO_PATH = path.join(BENCHMARK_CACHE_ROOT, "opentui");
export const BENCHMARK_FIXTURE_STATE_FILE = ".fixture-state.json";
export const BENCHMARK_FIXTURE_MODE = "benchmarks/fixtures/opentui.fixture.json";
export const LEGACY_BENCHMARK_REPO_PATH = path.resolve("benchmarks/repos/opentui");
