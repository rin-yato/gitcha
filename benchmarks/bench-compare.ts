import {
  buildBenchmarkReport,
  compareBenchmarkReports,
  loadBenchmarkReport,
  prepareBenchmarkContext,
  renderBenchmarkComparison,
  writeBenchmarkReport,
} from "./bench-core.ts";

const baselinePath = "benchmarks/latest.json";
const writeBaseline = process.argv.includes("--write");

const baseline = await loadBenchmarkReport(baselinePath);
if (!baseline) {
  throw new Error(`Missing benchmark baseline: ${baselinePath}`);
}

const context = await prepareBenchmarkContext();
const current = await buildBenchmarkReport(context);
const comparison = compareBenchmarkReports(current, baseline);

renderBenchmarkComparison(current, baseline, comparison);

if (writeBaseline) {
  await writeBenchmarkReport(baselinePath, current);
}
