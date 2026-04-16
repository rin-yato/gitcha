import { BENCHMARK_REPO_PATH, LEGACY_BENCHMARK_REPO_PATH } from "./bench-paths.ts";
import fs from "node:fs/promises";

await Promise.all([
  fs.rm(BENCHMARK_REPO_PATH, { recursive: true, force: true }),
  fs.rm(LEGACY_BENCHMARK_REPO_PATH, { recursive: true, force: true }),
]);

console.log(`Removed benchmark fixture cache: ${BENCHMARK_REPO_PATH}`);
console.log(`Removed legacy benchmark fixture cache: ${LEGACY_BENCHMARK_REPO_PATH}`);
