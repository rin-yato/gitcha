// @ts-nocheck
import {
  buildFileTreeSnapshot,
  detectRepoContext,
  execGit,
  generateDiff,
  getRepoStatus,
  parseDiffPositions,
} from "@/lib/git";
import { loadChangesDiffSource, loadStagedDiffSource } from "@/lib/git/files";

import {
  BENCHMARK_CACHE_ROOT,
  BENCHMARK_FIXTURE_MODE,
  BENCHMARK_FIXTURE_STATE_FILE,
  BENCHMARK_REPO_CWD,
  BENCHMARK_REPO_PATH,
  BENCHMARK_REPO_URL,
} from "./bench-paths.ts";
import fs from "node:fs/promises";
import path from "node:path";

export const DEFAULT_RUNS = 5;

type Measurement = {
  name: string;
  durationMs: number;
  ok: boolean;
  error?: string;
};

export type BenchmarkResult = Measurement & {
  run: number;
};

export type BenchmarkSummary = {
  name: string;
  runs: number;
  minMs: number;
  medianMs: number;
  meanMs: number;
  maxMs: number;
};

export type BenchmarkComparison = {
  name: string;
  baselineMs: number | null;
  currentMs: number;
  deltaMs: number | null;
  deltaPct: number | null;
};

export type BenchmarkReport = {
  repoPath: string;
  repoCwd: string;
  repoUrl: string;
  repoBaseCommit: string;
  repoCommit: string;
  fixtureMode: string | null;
  fixtureResetCommits: number | null;
  runs: number;
  startup: StartupBenchmarkReport;
  results: BenchmarkResult[];
  summary: BenchmarkSummary[];
};

export type StartupBenchmarkReport = {
  bootstrapStartedMs: number;
  rendererStartedMs: number;
  rendererReadyMs?: number;
  renderCalledMs?: number;
  bootstrapResolvedMs?: number;
  bootstrapRejectedMs?: number;
  firstPaintMs?: number;
  bootstrapError?: string;
  totalMs: number;
};

export type BenchmarkContext = {
  repoPath: string;
  repoCwd: string;
  cwd: string;
  repoUrl: string;
  repoBaseCommit: string;
  repoCommit: string;
  fixtureMode: string | null;
  fixtureResetCommits: number | null;
};

type FixtureState = {
  baseCommit: string;
  targetCommit: string;
  resetCommits: number;
};

const FIXTURE_STATE_FILE = BENCHMARK_FIXTURE_STATE_FILE;
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

function formatBenchmarkName(name: string): string {
  return name.replace(/^bench\./, "");
}

function formatCommit(value: string): string {
  return value.length > 12 ? value.slice(0, 12) : value;
}

export function formatMs(value: number): string {
  return `${value.toFixed(2)}ms`;
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

function stripAnsi(value: string): string {
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
}

function createSink(run: number, results: BenchmarkResult[]) {
  return (measurement: Measurement) => {
    results.push({ ...measurement, run });
  };
}

async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  sink: (m: Measurement) => void,
) {
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

function measureSync<T>(name: string, fn: () => T, sink: (m: Measurement) => void): T {
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

function formatSummaryLine(label: string, value: string): string {
  return `${label.padEnd(18)} ${value}`;
}

function renderSummaryRows(summary: BenchmarkSummary[]): string[] {
  if (summary.length === 0) {
    return ["(no phase data)"];
  }

  const rows = summary.map((entry) => ({
    phase: formatBenchmarkName(entry.name),
    current: formatMs(entry.medianMs),
    stats: `${formatMs(entry.minMs)} / ${formatMs(entry.meanMs)} / ${formatMs(entry.maxMs)}`,
  }));

  const widths = rows.reduce(
    (acc, row) => ({
      phase: Math.max(acc.phase, row.phase.length),
      current: Math.max(acc.current, row.current.length),
      stats: Math.max(acc.stats, row.stats.length),
    }),
    { phase: 5, current: 7, stats: 20 },
  );

  return [
    [
      "Phase".padEnd(widths.phase),
      "Median".padStart(widths.current),
      "Stats".padStart(widths.stats),
    ].join("  "),
    ...rows.map((row) =>
      [
        row.phase.padEnd(widths.phase),
        bold(row.current.padStart(widths.current)),
        row.stats.padStart(widths.stats),
      ].join("  "),
    ),
  ];
}

function renderComparisonRows(comparison: BenchmarkComparison[]): string[] {
  if (comparison.length === 0) {
    return ["(no comparison data)"];
  }

  const rows = comparison.map((entry) => ({
    phase: formatBenchmarkName(entry.name),
    current: formatMs(entry.currentMs),
    baseline: entry.baselineMs === null ? "n/a" : formatMs(entry.baselineMs),
    delta: formatDeltaColored(entry.deltaMs),
    percent: formatPercentChangeColored(entry.deltaMs, entry.baselineMs),
    trend: formatDirectionColored(entry.deltaMs),
  }));

  const widths = rows.reduce(
    (acc, row) => ({
      phase: Math.max(acc.phase, row.phase.length),
      current: Math.max(acc.current, row.current.length),
      baseline: Math.max(acc.baseline, row.baseline.length),
      delta: Math.max(acc.delta, stripAnsi(row.delta).length),
      percent: Math.max(acc.percent, stripAnsi(row.percent).length),
      trend: Math.max(acc.trend, stripAnsi(row.trend).length),
    }),
    { phase: 5, current: 7, baseline: 8, delta: 6, percent: 5, trend: 6 },
  );

  return [
    [
      "Phase".padEnd(widths.phase),
      "Current".padStart(widths.current),
      "Baseline".padStart(widths.baseline),
      "Delta".padStart(widths.delta),
      "%".padStart(widths.percent),
      "Trend".padStart(widths.trend),
    ].join("  "),
    ...rows.map((row) =>
      [
        row.phase.padEnd(widths.phase),
        bold(row.current.padStart(widths.current)),
        row.baseline.padStart(widths.baseline),
        row.delta.padStart(widths.delta),
        row.percent.padStart(widths.percent),
        row.trend.padStart(widths.trend),
      ].join("  "),
    ),
  ];
}

function summarizeComparison(comparison: BenchmarkComparison[]) {
  const summary = {
    faster: 0,
    slower: 0,
    unchanged: 0,
    missing: 0,
    bestWin: null as null | BenchmarkComparison,
    worstRegression: null as null | BenchmarkComparison,
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

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureRepo(repoUrl: string, repoPath: string): Promise<void> {
  const gitDirPath = path.join(repoPath, ".git");
  const stateFilePath = path.join(repoPath, FIXTURE_STATE_FILE);

  if ((await pathExists(repoPath)) && !(await pathExists(gitDirPath))) {
    await fs.rm(repoPath, { recursive: true, force: true });
  }

  if (
    (await pathExists(repoPath)) &&
    (await pathExists(gitDirPath)) &&
    !(await pathExists(stateFilePath))
  ) {
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

async function loadFixtureState(pathname: string): Promise<FixtureState | null> {
  if (!(await pathExists(pathname))) return null;

  try {
    const content = await Bun.file(pathname).text();
    return JSON.parse(content) as FixtureState;
  } catch {
    return null;
  }
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
  await execGit(["reset", "--soft", targetCommit], { cwd: repoPath });
}

async function writeFixtureState(pathname: string, state: FixtureState): Promise<void> {
  await fs.writeFile(pathname, `${JSON.stringify(state, null, 2)}\n`);
}

async function applyFixture(
  repoPath: string,
  fixtureMode: string,
): Promise<FixtureState | null> {
  const fixturePath = path.resolve(fixtureMode);
  if (!(await pathExists(fixturePath))) return null;

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
    if (!selectedFile) continue;

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

  return results;
}

export async function prepareBenchmarkContext(): Promise<BenchmarkContext> {
  await ensureRepo(BENCHMARK_REPO_URL, BENCHMARK_REPO_PATH);
  const fixtureState = await applyFixture(BENCHMARK_REPO_PATH, BENCHMARK_FIXTURE_MODE);
  const cwd = path.resolve(BENCHMARK_REPO_PATH, BENCHMARK_REPO_CWD);
  const repoCommit = await readRepoCommit(cwd);

  return {
    repoPath: BENCHMARK_REPO_PATH,
    repoCwd: BENCHMARK_REPO_CWD,
    cwd,
    repoUrl: BENCHMARK_REPO_URL,
    repoBaseCommit: fixtureState?.baseCommit ?? repoCommit,
    repoCommit,
    fixtureMode: BENCHMARK_FIXTURE_MODE,
    fixtureResetCommits: fixtureState?.resetCommits ?? null,
  };
}

export async function buildBenchmarkReport(
  context: BenchmarkContext,
  runs = DEFAULT_RUNS,
): Promise<BenchmarkReport> {
  const results = await runBenchmark({ cwd: context.cwd, runs });
  const startup = await runStartupBenchmark();
  return {
    repoPath: context.repoPath,
    repoCwd: context.repoCwd,
    repoUrl: context.repoUrl,
    repoBaseCommit: context.repoBaseCommit,
    repoCommit: context.repoCommit,
    fixtureMode: context.fixtureMode,
    fixtureResetCommits: context.fixtureResetCommits,
    runs,
    startup,
    results,
    summary: summarize(results),
  };
}

export async function loadBenchmarkReport(pathname: string): Promise<BenchmarkReport | null> {
  try {
    const content = await fs.readFile(pathname, "utf8");
    return JSON.parse(content) as BenchmarkReport;
  } catch {
    return null;
  }
}

export async function writeBenchmarkReport(
  pathname: string,
  report: BenchmarkReport,
): Promise<void> {
  await fs.writeFile(pathname, `${JSON.stringify(report, null, 2)}\n`);
}

export async function runStartupBenchmark(): Promise<StartupBenchmarkReport> {
  const snapshotPath = path.join(BENCHMARK_CACHE_ROOT, "startup-benchmark.json");
  await fs.rm(snapshotPath, { force: true });

  const proc = Bun.spawn(["bun", "run", "src/index.tsx"], {
    cwd: path.resolve("."),
    env: {
      ...process.env,
      CHANGES_STARTUP_BENCHMARK_PATH: snapshotPath,
    },
    stdout: "pipe",
    stderr: "inherit",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`startup benchmark failed with exit code ${exitCode}`);
  }

  const content = await fs.readFile(snapshotPath, "utf8");

  return JSON.parse(content) as StartupBenchmarkReport;
}

export function compareBenchmarkReports(
  current: BenchmarkReport,
  baseline: BenchmarkReport | null,
): BenchmarkComparison[] | null {
  if (!baseline) return null;

  const baselineByName = new Map(baseline.summary.map((entry) => [entry.name, entry]));
  return current.summary.map((entry) => {
    const prev = baselineByName.get(entry.name);
    if (!prev) {
      return {
        name: entry.name,
        baselineMs: null,
        currentMs: entry.medianMs,
        deltaMs: null,
        deltaPct: null,
      };
    }

    const deltaMs = entry.medianMs - prev.medianMs;
    return {
      name: entry.name,
      baselineMs: prev.medianMs,
      currentMs: entry.medianMs,
      deltaMs,
      deltaPct: prev.medianMs === 0 ? null : (deltaMs / prev.medianMs) * 100,
    };
  });
}

export function renderBenchmarkReport(report: BenchmarkReport): void {
  const lines = [
    bold("Benchmark report"),
    formatSummaryLine("Repo", report.repoUrl),
    formatSummaryLine("Path", report.repoPath),
    formatSummaryLine("Cwd", report.repoCwd),
    formatSummaryLine("Current commit", formatCommit(report.repoCommit)),
    formatSummaryLine("Base commit", formatCommit(report.repoBaseCommit)),
    formatSummaryLine("Runs", String(report.runs)),
    formatSummaryLine(
      "Fixture",
      report.fixtureMode
        ? `${report.fixtureMode} (reset ${report.fixtureResetCommits ?? "n/a"} commits)`
        : "disabled",
    ),
    "",
    ...renderTimingSection("Startup", startupTimingRows(report.startup)),
    cyan(bold("Results")),
    "Stats: min / mean / max",
    "",
    ...renderSummaryRows(report.summary),
  ];

  console.log(lines.join("\n"));
}

export function renderBenchmarkComparison(
  current: BenchmarkReport,
  baseline: BenchmarkReport | null,
  comparison: BenchmarkComparison[] | null,
): void {
  const startupBaseline = baseline?.startup ?? null;
  const lines = [
    bold("Benchmark compare"),
    formatSummaryLine("Repo", current.repoUrl),
    formatSummaryLine("Path", current.repoPath),
    formatSummaryLine("Cwd", current.repoCwd),
    formatSummaryLine("Current", formatCommit(current.repoCommit)),
    formatSummaryLine("Baseline", baseline ? formatCommit(baseline.repoCommit) : "missing"),
    formatSummaryLine("Runs", String(current.runs)),
    formatSummaryLine(
      "Fixture",
      current.fixtureMode
        ? `${current.fixtureMode} (reset ${current.fixtureResetCommits ?? "n/a"} commits)`
        : "disabled",
    ),
    "",
    cyan(bold("Summary")),
  ];

  lines.push(
    ...renderTimingSection("Startup", startupTimingRows(current.startup, startupBaseline), {
      compare: Boolean(startupBaseline),
    }),
  );

  if (!comparison || !baseline) {
    lines.push(formatSummaryLine("Result", "no baseline found"));
    lines.push(formatSummaryLine("Hint", "run `bun run bench:latest` first"));
    lines.push("");
    lines.push(cyan(bold("Comparison")));
    lines.push("Stats: min / mean / max");
    lines.push("");
    lines.push(...renderSummaryRows(current.summary));
    console.log(lines.join("\n"));
    return;
  }

  const overview = summarizeComparison(comparison);
  lines.push(
    formatSummaryLine(
      "Result mix",
      `${green(`${overview.faster} faster`)}  ${red(`${overview.slower} slower`)}  ${yellow(`${overview.unchanged} unchanged`)}${overview.missing > 0 ? `  ${overview.missing} missing` : ""}`,
    ),
  );
  if (overview.bestWin) {
    lines.push(
      formatSummaryLine(
        "Best win",
        `${formatBenchmarkName(overview.bestWin.name)} ${green(formatDelta(overview.bestWin.deltaMs))} ${green(formatPercentChange(overview.bestWin.deltaMs, overview.bestWin.baselineMs))}`,
      ),
    );
  }
  if (overview.worstRegression) {
    lines.push(
      formatSummaryLine(
        "Worst regression",
        `${formatBenchmarkName(overview.worstRegression.name)} ${red(formatDelta(overview.worstRegression.deltaMs))} ${red(formatPercentChange(overview.worstRegression.deltaMs, overview.worstRegression.baselineMs))}`,
      ),
    );
  }

  lines.push(
    "",
    cyan(bold("Comparison")),
    "Stats: current / baseline / delta / %",
    "",
    ...renderComparisonRows(comparison),
    "",
    cyan(bold("Current results")),
    "Stats: min / mean / max",
    "",
    ...renderSummaryRows(current.summary),
  );
  console.log(lines.join("\n"));
}

type TimingRow = {
  label: string;
  current: number;
  baseline?: number | null;
};

function startupTimingRows(
  current: StartupBenchmarkReport,
  baseline?: StartupBenchmarkReport | null,
): TimingRow[] {
  return [
    ["Renderer ready", current.rendererReadyMs, baseline?.rendererReadyMs],
    ["Render called", current.renderCalledMs, baseline?.renderCalledMs],
    ["Bootstrap resolved", current.bootstrapResolvedMs, baseline?.bootstrapResolvedMs],
    ["First paint", current.firstPaintMs, baseline?.firstPaintMs],
    ["Total", current.totalMs, baseline?.totalMs],
  ].map(([label, currentValue, baselineValue]) => ({
    label,
    current: currentValue ?? 0,
    baseline: baselineValue ?? null,
  }));
}

function renderTimingSection(
  title: string,
  rows: TimingRow[],
  options?: { compare?: boolean },
): string[] {
  const compare = options?.compare ?? false;
  const widths = rows.reduce(
    (acc, row) => ({
      label: Math.max(acc.label, row.label.length),
      current: Math.max(acc.current, formatMs(row.current).length),
      baseline: Math.max(
        acc.baseline,
        row.baseline === null ? 8 : formatMs(row.baseline ?? 0).length,
      ),
      delta: Math.max(
        acc.delta,
        row.baseline === null ? 3 : formatDelta(row.current - row.baseline).length,
      ),
    }),
    { label: 10, current: 7, baseline: 8, delta: 5 },
  );

  return [
    cyan(bold(title)),
    "",
    compare
      ? [
          "Phase".padEnd(widths.label),
          "Current".padStart(widths.current),
          "Baseline".padStart(widths.baseline),
          "Delta".padStart(widths.delta),
        ].join("  ")
      : ["Phase".padEnd(widths.label), "Time".padStart(widths.current)].join("  "),
    ...rows.map((row) => {
      if (!compare) {
        return [
          row.label.padEnd(widths.label),
          bold(formatMs(row.current).padStart(widths.current)),
        ].join("  ");
      }

      const baseline = row.baseline ?? 0;
      return [
        row.label.padEnd(widths.label),
        bold(formatMs(row.current).padStart(widths.current)),
        formatMs(baseline).padStart(widths.baseline),
        formatDelta(row.current - baseline).padStart(widths.delta),
      ].join("  ");
    }),
    "",
  ];
}
