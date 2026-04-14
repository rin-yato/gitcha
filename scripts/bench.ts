import {
  buildFileTreeSnapshot,
  detectRepoContext,
  generateDiff,
  getRepoStatus,
  parseDiffPositions,
} from "@/lib/git";
import { loadChangesDiffSource, loadStagedDiffSource } from "@/lib/git/files";

import {
  BENCHMARK_FIXTURE_MODE,
  BENCHMARK_FIXTURE_STATE_FILE,
  BENCHMARK_REPO_PATH,
} from "./bench-paths.ts";
import fs from "node:fs/promises";
import path from "node:path";

type Measurement = {
  name: string;
  durationMs: number;
  ok: boolean;
  attributes?: Record<string, string | number | boolean>;
  error?: string;
};

type BenchmarkResult = Measurement & {
  run: number;
};

type BenchmarkSummary = {
  name: string;
  runs: number;
  minMs: number;
  medianMs: number;
  meanMs: number;
  maxMs: number;
};

type BenchmarkReport = {
  repoUrl: string;
  repoPath: string;
  repoBaseCommit: string;
  repoCommit: string;
  fixtureMode: string | null;
  fixtureResetCommits: number | null;
  cwd: string;
  runs: number;
  results: BenchmarkResult[];
  summary: BenchmarkSummary[];
};

type CliArgs = {
  repoUrl: string;
  repoPath: string;
  cwd: string;
  runs: number;
  fixtureMode: string | null;
  outPath: string | null;
  baselinePath: string | null;
  json: boolean;
};

const DEFAULT_REPO_URL = "https://github.com/anomalyco/opentui";
const DEFAULT_REPO_DIR = BENCHMARK_REPO_PATH;
const DEFAULT_FIXTURE_MODE = BENCHMARK_FIXTURE_MODE;
const FIXTURE_STATE_FILE = BENCHMARK_FIXTURE_STATE_FILE;

type FixtureState = {
  baseCommit: string;
  targetCommit: string;
  resetCommits: number;
};

function createSink(run: number, results: BenchmarkResult[]) {
  return (measurement: Measurement) => {
    results.push({ ...measurement, run });
  };
}

async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  sink: (measurement: Measurement) => void,
): Promise<T> {
  const startedAt = performance.now();

  try {
    const result = await fn();
    sink({ name, durationMs: performance.now() - startedAt, ok: true });
    return result;
  } catch (error) {
    sink({
      name,
      durationMs: performance.now() - startedAt,
      ok: false,
      error: error instanceof Error ? error.message : "Unknown",
    });
    throw error;
  }
}

function measureSync<T>(
  name: string,
  fn: () => T,
  sink: (measurement: Measurement) => void,
): T {
  const startedAt = performance.now();

  try {
    const result = fn();
    sink({ name, durationMs: performance.now() - startedAt, ok: true });
    return result;
  } catch (error) {
    sink({
      name,
      durationMs: performance.now() - startedAt,
      ok: false,
      error: error instanceof Error ? error.message : "Unknown",
    });
    throw error;
  }
}

function median(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : (sorted[middle] ?? 0);
}

function formatMs(value: number): string {
  return `${value.toFixed(2)}ms`;
}

const supportsColor = Boolean(process.stdout.isTTY) && !Bun.env.NO_COLOR;

const ansi = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};

function paint(value: string, code: string): string {
  if (!supportsColor) return value;
  return `${code}${value}${ansi.reset}`;
}

function bold(value: string): string {
  return paint(value, ansi.bold);
}

function cyan(value: string): string {
  return paint(value, ansi.cyan);
}

function red(value: string): string {
  return paint(value, ansi.red);
}

function green(value: string): string {
  return paint(value, ansi.green);
}

function yellow(value: string): string {
  return paint(value, ansi.yellow);
}

function formatOptionalMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return "n/a";
  return formatMs(value);
}

function formatDelta(value: number | null): string {
  if (value === null) return "n/a";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}ms`;
}

function formatPercentChange(deltaMs: number | null, baselineMs: number | null): string {
  if (deltaMs === null || baselineMs === null || baselineMs === 0) return "n/a";

  const percentage = (deltaMs / baselineMs) * 100;
  const sign = percentage > 0 ? "+" : "";
  return `${sign}${percentage.toFixed(1)}%`;
}

function formatDirection(deltaMs: number | null): string {
  if (deltaMs === null) return "changed";
  if (deltaMs < 0) return "faster";
  if (deltaMs > 0) return "slower";
  return "unchanged";
}

function formatDirectionColored(deltaMs: number | null): string {
  const value = formatDirection(deltaMs);
  if (deltaMs === null) return value;
  if (deltaMs < 0) return green(value);
  if (deltaMs > 0) return red(value);
  return yellow(value);
}

function formatDeltaColored(value: number | null): string {
  const formatted = formatDelta(value);
  if (value === null) return formatted;
  if (value < 0) return green(formatted);
  if (value > 0) return red(formatted);
  return yellow(formatted);
}

function formatPercentChangeColored(deltaMs: number | null, baselineMs: number | null): string {
  const formatted = formatPercentChange(deltaMs, baselineMs);
  if (deltaMs === null || baselineMs === null || baselineMs === 0) return formatted;
  if (deltaMs < 0) return green(formatted);
  if (deltaMs > 0) return red(formatted);
  return yellow(formatted);
}

function formatBenchmarkDisplay(name: string): string {
  return name
    .replace(/^bench\./, "")
    .replaceAll(".", " ")
    .replaceAll(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();
}

function formatSummaryLine(label: string, value: string): string {
  return `${label.padEnd(18)} ${value}`;
}

function summarize(results: BenchmarkResult[]): BenchmarkSummary[] {
  const grouped = results.reduce<Map<string, BenchmarkResult[]>>((acc, result) => {
    const current = acc.get(result.name);

    if (current) {
      current.push(result);
      return acc;
    }

    acc.set(result.name, [result]);
    return acc;
  }, new Map());

  return [...grouped.entries()].map(([name, entries]) => {
    const durations = entries.map((entry) => entry.durationMs);
    const total = durations.reduce((sum, value) => sum + value, 0);

    return {
      name,
      runs: entries.length,
      minMs: Math.min(...durations),
      medianMs: median(durations),
      meanMs: total / durations.length,
      maxMs: Math.max(...durations),
    };
  });
}

async function ensureRepo(repoUrl: string, repoPath: string): Promise<void> {
  const gitDirPath = path.join(repoPath, ".git");
  const stateFilePath = path.join(repoPath, FIXTURE_STATE_FILE);
  const gitDirExists = await pathExists(gitDirPath);
  const stateFileExists = await pathExists(stateFilePath);

  if ((await pathExists(repoPath)) && !gitDirExists) {
    await fs.rm(repoPath, { recursive: true, force: true });
  }

  if ((await pathExists(repoPath)) && gitDirExists && !stateFileExists) {
    await fs.rm(repoPath, { recursive: true, force: true });
  }

  if (!(await pathExists(gitDirPath))) {
    await fs.mkdir(path.dirname(repoPath), { recursive: true });
    await new Promise<void>((resolve, reject) => {
      const proc = Bun.spawn(["git", "clone", repoUrl, repoPath], {
        stdout: "inherit",
        stderr: "inherit",
      });

      proc.exited.then((code) => {
        if (code === 0) resolve();
        else reject(new Error(`git clone failed with exit code ${code}`));
      });
    });
  }

  const shallow = await isShallowRepository(repoPath);
  if (shallow) {
    await new Promise<void>((resolve, reject) => {
      const proc = Bun.spawn(
        ["git", "-C", repoPath, "fetch", "--unshallow", "--tags", "origin"],
        {
          stdout: "inherit",
          stderr: "inherit",
        },
      );

      proc.exited.then((code) => {
        if (code === 0) resolve();
        else reject(new Error(`git fetch --unshallow failed with exit code ${code}`));
      });
    });
  }
}

async function pathExists(pathname: string): Promise<boolean> {
  try {
    await fs.access(pathname);
    return true;
  } catch {
    return false;
  }
}

async function isShallowRepository(repoPath: string): Promise<boolean> {
  const proc = Bun.spawn(["git", "-C", repoPath, "rev-parse", "--is-shallow-repository"], {
    stdout: "pipe",
    stderr: "inherit",
  });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) return false;
  return output.trim() === "true";
}

async function readRepoCommit(repoPath: string): Promise<string> {
  const proc = Bun.spawn(["git", "-C", repoPath, "rev-parse", "HEAD"], {
    stdout: "pipe",
    stderr: "inherit",
  });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) throw new Error(`git rev-parse failed with exit code ${exitCode}`);
  return output.trim();
}

async function applyFixture(
  repoPath: string,
  fixtureMode: string | null,
): Promise<FixtureState | null> {
  if (!fixtureMode) return null;

  const fixturePath = path.resolve(fixtureMode);
  if (!(await Bun.file(fixturePath).exists())) return null;

  const fixture = JSON.parse(await Bun.file(fixturePath).text()) as { resetCommits?: number };
  const resetCommits = fixture.resetCommits ?? 15;
  const statePath = path.join(repoPath, FIXTURE_STATE_FILE);

  const existingState = await loadFixtureState(statePath);
  if (existingState) {
    const currentCommit = await readRepoCommit(repoPath);
    if (currentCommit !== existingState.targetCommit) {
      await softReset(repoPath, existingState.targetCommit);
    }

    return existingState;
  }

  const baseCommit = await readRepoCommit(repoPath);
  const targetCommit = await resolveAncestorCommit(repoPath, resetCommits);
  await softReset(repoPath, targetCommit);
  const state = { baseCommit, targetCommit, resetCommits };
  await writeFixtureState(statePath, state);

  return state;
}

async function resolveAncestorCommit(repoPath: string, resetCommits: number): Promise<string> {
  const proc = Bun.spawn(["git", "-C", repoPath, "rev-parse", `HEAD~${resetCommits}`], {
    stdout: "pipe",
    stderr: "inherit",
  });
  const output = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`git rev-parse HEAD~${resetCommits} failed with exit code ${exitCode}`);
  }
  return output.trim();
}

async function softReset(repoPath: string, targetCommit: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const proc = Bun.spawn(["git", "-C", repoPath, "reset", "--soft", targetCommit], {
      stdout: "inherit",
      stderr: "inherit",
    });

    proc.exited.then((code) => {
      if (code === 0) resolve();
      else reject(new Error(`git reset failed with exit code ${code}`));
    });
  });
}

async function loadFixtureState(pathname: string): Promise<FixtureState | null> {
  if (!(await Bun.file(pathname).exists())) return null;

  try {
    const content = await Bun.file(pathname).text();
    return JSON.parse(content) as FixtureState;
  } catch {
    return null;
  }
}

async function writeFixtureState(pathname: string, state: FixtureState): Promise<void> {
  await fs.writeFile(pathname, `${JSON.stringify(state, null, 2)}\n`);
}

async function runBenchmark(options: {
  cwd: string;
  runs: number;
}): Promise<BenchmarkResult[]> {
  const { cwd, runs } = options;
  const results: BenchmarkResult[] = [];

  for (let run = 1; run <= runs; run += 1) {
    const sink = createSink(run, results);

    const context = await measureAsync(
      "bench.detectRepoContext",
      () => detectRepoContext(cwd),
      sink,
    );

    if (!context) {
      throw new Error(`Not a git repository: ${cwd}`);
    }

    const status = await measureAsync("bench.getRepoStatus", () => getRepoStatus(cwd), sink);

    const stagedTree = measureSync(
      "bench.buildFileTree.staged",
      () => buildFileTreeSnapshot(status.files.staged),
      sink,
    );
    const changesTree = measureSync(
      "bench.buildFileTree.changes",
      () => buildFileTreeSnapshot([...status.files.changes, ...status.files.untracked]),
      sink,
    );

    const selectedFile = stagedTree.orderedFiles[0] ?? changesTree.orderedFiles[0];

    if (selectedFile) {
      const isStaged = stagedTree.orderedFiles[0]?.path === selectedFile.path;
      const source = await measureAsync(
        "bench.loadDiffSource",
        () =>
          isStaged
            ? loadStagedDiffSource(context, selectedFile)
            : loadChangesDiffSource(context, selectedFile),
        sink,
      );

      const diff = measureSync(
        "bench.generateDiff",
        () => generateDiff(source, selectedFile.path),
        sink,
      );

      measureSync("bench.parseDiffPositions", () => parseDiffPositions(diff), sink);
    }
  }

  return results;
}

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2);
  const repoUrlArg = args.find((arg) => arg.startsWith("--repo-url="));
  const repoPathArg = args.find((arg) => arg.startsWith("--repo-path="));
  const fixtureModeArg = args.find((arg) => arg.startsWith("--fixture-mode="));
  const cwdArg = args.find((arg) => !arg.startsWith("--"));
  const runsArg = args.find((arg) => arg.startsWith("--runs="));
  const outputArg = args.find((arg) => arg.startsWith("--out="));
  const baselineArg = args.find((arg) => arg.startsWith("--baseline="));
  const json = args.includes("--json");
  const runs = runsArg ? Number(runsArg.slice("--runs=".length)) : 5;

  return {
    repoUrl: repoUrlArg ? repoUrlArg.slice("--repo-url=".length) : DEFAULT_REPO_URL,
    repoPath: repoPathArg ? repoPathArg.slice("--repo-path=".length) : DEFAULT_REPO_DIR,
    cwd: cwdArg ?? process.cwd(),
    runs: Number.isFinite(runs) && runs > 0 ? Math.floor(runs) : 5,
    fixtureMode: fixtureModeArg
      ? fixtureModeArg.slice("--fixture-mode=".length)
      : DEFAULT_FIXTURE_MODE,
    outPath: outputArg ? outputArg.slice("--out=".length) : null,
    baselinePath: baselineArg ? baselineArg.slice("--baseline=".length) : null,
    json,
  };
}

async function loadBaseline(path: string | null): Promise<BenchmarkReport | null> {
  if (!path) return null;
  try {
    const content = await fs.readFile(path, "utf8");
    const parsed = JSON.parse(content) as Partial<BenchmarkReport>;

    if (Array.isArray(parsed.summary)) {
      return parsed as BenchmarkReport;
    }

    return null;
  } catch {
    return null;
  }
}

function compareReports(current: BenchmarkReport, baseline: BenchmarkReport | null) {
  if (!baseline) return null;

  const baselineByName = new Map(baseline.summary.map((entry) => [entry.name, entry]));
  return current.summary.map((entry) => {
    const prev = baselineByName.get(entry.name);
    if (!prev) {
      return {
        name: entry.name,
        deltaMs: null,
        deltaPct: null,
        baselineMs: null,
        currentMs: entry.medianMs,
      };
    }

    return {
      name: entry.name,
      deltaMs: entry.medianMs - prev.medianMs,
      deltaPct:
        prev.medianMs === 0 ? null : ((entry.medianMs - prev.medianMs) / prev.medianMs) * 100,
      baselineMs: prev.medianMs,
      currentMs: entry.medianMs,
    };
  });
}

function formatComparison(comparison: NonNullable<ReturnType<typeof compareReports>>) {
  return comparison.map((entry) => ({
    name: entry.name,
    baselineMs: entry.baselineMs,
    currentMs: entry.currentMs,
    deltaMs: entry.deltaMs,
    deltaPct: entry.deltaPct,
  }));
}

function summarizeComparison(comparison: NonNullable<ReturnType<typeof compareReports>>) {
  const summary = {
    faster: 0,
    slower: 0,
    unchanged: 0,
    missing: 0,
    bestWin: null as null | (typeof comparison)[number],
    worstRegression: null as null | (typeof comparison)[number],
  };

  for (const entry of comparison) {
    if (entry.baselineMs === null || entry.deltaMs === null) {
      summary.missing += 1;
      continue;
    }

    if (entry.deltaMs < 0) summary.faster += 1;
    else if (entry.deltaMs > 0) summary.slower += 1;
    else summary.unchanged += 1;

    if (!summary.bestWin || entry.deltaMs < summary.bestWin.deltaMs!) {
      summary.bestWin = entry;
    }

    if (!summary.worstRegression || entry.deltaMs > summary.worstRegression.deltaMs!) {
      summary.worstRegression = entry;
    }
  }

  return summary;
}

function renderReport(report: BenchmarkReport, comparison: ReturnType<typeof compareReports>) {
  const comparisonByName = new Map(comparison?.map((entry) => [entry.name, entry]) ?? []);

  const rows = report.summary.map((entry) => {
    const matched = comparisonByName.get(entry.name);
    return {
      name: entry.name,
      phase: formatBenchmarkDisplay(entry.name),
      current: formatMs(entry.medianMs),
      baseline: formatOptionalMs(matched?.baselineMs),
      delta: formatDeltaColored(matched?.deltaMs ?? null),
      percent: formatPercentChangeColored(
        matched?.deltaMs ?? null,
        matched?.baselineMs ?? null,
      ),
      trend: formatDirectionColored(matched?.deltaMs ?? null),
      stats: `${formatMs(entry.minMs)} / ${formatMs(entry.meanMs)} / ${formatMs(entry.maxMs)}`,
    };
  });

  // Calculate column widths for clean table layout
  const stripAnsi = (value: string): string => {
    let result = "";
    for (let index = 0; index < value.length; index += 1) {
      const charCode = value.charCodeAt(index);
      if (charCode === 27 && value[index + 1] === "[") {
        index += 2;
        while (index < value.length) {
          const seqChar = value.charCodeAt(index);
          if (seqChar >= 0x40 && seqChar <= 0x7e) break;
          index += 1;
        }
        continue;
      }
      result += value[index];
    }
    return result;
  };

  const widths = rows.reduce(
    (acc, row) => ({
      phase: Math.max(acc.phase, row.phase.length),
      current: Math.max(acc.current, row.current.length),
      baseline: Math.max(acc.baseline, row.baseline.length),
      delta: Math.max(acc.delta, stripAnsi(row.delta).length),
      percent: Math.max(acc.percent, stripAnsi(row.percent).length),
      trend: Math.max(acc.trend, stripAnsi(row.trend).length),
      stats: Math.max(acc.stats, row.stats.length),
    }),
    { phase: 5, current: 7, baseline: 8, delta: 6, percent: 5, trend: 6, stats: 20 },
  );

  const overview = comparison ? summarizeComparison(comparison) : null;

  const lines = [
    bold("Startup benchmark"),
    formatSummaryLine("Repo", report.repoUrl),
    formatSummaryLine("Path", report.repoPath),
    formatSummaryLine("Current commit", report.repoCommit),
    formatSummaryLine("Base commit", report.repoBaseCommit),
    formatSummaryLine("Runs", String(report.runs)),
    formatSummaryLine(
      "Fixture",
      report.fixtureMode
        ? `${report.fixtureMode} (reset ${report.fixtureResetCommits ?? "n/a"} commits)`
        : "disabled",
    ),
    "",
    cyan(bold("Overview")),
    overview
      ? formatSummaryLine(
          "Result mix",
          `${green(`${overview.faster} faster`)}  ${red(`${overview.slower} slower`)}  ${yellow(`${overview.unchanged} unchanged`)}${overview.missing > 0 ? `  ${overview.missing} missing` : ""}`,
        )
      : formatSummaryLine("Result mix", "no baseline"),
    overview?.bestWin
      ? formatSummaryLine(
          "Best win",
          `${formatBenchmarkDisplay(overview.bestWin.name)} ${green(formatDelta(overview.bestWin.deltaMs))} ${green(formatPercentChange(overview.bestWin.deltaMs, overview.bestWin.baselineMs))}`,
        )
      : null,
    overview?.worstRegression
      ? formatSummaryLine(
          "Biggest regression",
          `${formatBenchmarkDisplay(overview.worstRegression.name)} ${red(formatDelta(overview.worstRegression.deltaMs))} ${red(formatPercentChange(overview.worstRegression.deltaMs, overview.worstRegression.baselineMs))}`,
        )
      : null,
    "",
    cyan(bold("Phases")),
    "Stats: min / mean / max",
    "",
    // Table header
    [
      "Phase".padEnd(widths.phase),
      "Current".padStart(widths.current),
      "Baseline".padStart(widths.baseline),
      "Delta".padStart(widths.delta),
      "%".padStart(widths.percent),
      "Trend".padStart(widths.trend),
      "Stats".padStart(widths.stats),
    ].join("  "),
    // Table rows
    ...rows.map((row) =>
      [
        row.phase.padEnd(widths.phase),
        bold(row.current.padStart(widths.current)),
        row.baseline.padStart(widths.baseline),
        row.delta.padStart(widths.delta),
        row.percent.padStart(widths.percent),
        row.trend.padStart(widths.trend),
        row.stats.padStart(widths.stats),
      ].join("  "),
    ),
  ].filter((line): line is string => line !== null);

  console.log(lines.join("\n"));
}

async function main() {
  const { repoUrl, repoPath, cwd, runs, fixtureMode, outPath, baselinePath, json } = parseArgs(
    process.argv,
  );
  const absoluteRepoPath = path.resolve(cwd, repoPath);

  await ensureRepo(repoUrl, absoluteRepoPath);
  const fixtureState = await applyFixture(absoluteRepoPath, fixtureMode);
  const repoCommit = await readRepoCommit(absoluteRepoPath);
  const results = await runBenchmark({ cwd: absoluteRepoPath, runs });

  const report: BenchmarkReport = {
    repoUrl,
    repoPath: absoluteRepoPath,
    repoBaseCommit: fixtureState?.baseCommit ?? repoCommit,
    repoCommit,
    fixtureMode,
    fixtureResetCommits: fixtureState?.resetCommits ?? null,
    cwd: absoluteRepoPath,
    runs,
    results,
    summary: summarize(results),
  };

  const baseline = await loadBaseline(baselinePath);
  const comparison = compareReports(report, baseline);

  if (outPath) {
    await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`);
  }

  if (json) {
    console.log(
      JSON.stringify({ report, comparison: formatComparison(comparison ?? []) }, null, 2),
    );
  } else {
    renderReport(report, comparison);
  }
}

await main();
