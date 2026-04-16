import {
  buildBenchmarkReport,
  DEFAULT_RUNS,
  prepareBenchmarkContext,
  renderBenchmarkReport,
  writeBenchmarkReport,
} from "./bench-core.ts";

const emitJson = process.argv.includes("--json");
const writeLatest = process.argv.includes("--write-latest");
const context = await prepareBenchmarkContext();
const report = await buildBenchmarkReport(context, DEFAULT_RUNS);

if (emitJson) {
  if (writeLatest) {
    await writeBenchmarkReport("benchmarks/latest.json", report);
  } else {
    console.log(JSON.stringify(report, null, 2));
  }
} else {
  renderBenchmarkReport(report);
}
