import { addDefaultParsers, createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";

import { bootstrapReviewSession } from "@/context/session/session";

import { createStartupBenchmarkRecorder } from "@/lib/startup-benchmark";
import { parsers } from "@/lib/tree-sitter";
import "@/renderables/register";

import { AppRootWithBootstrap } from "@/app";

addDefaultParsers(parsers);

const startupBenchmarkPath = process.env.CHANGES_STARTUP_BENCHMARK_PATH;
const benchmark = startupBenchmarkPath
  ? createStartupBenchmarkRecorder(startupBenchmarkPath)
  : null;

benchmark?.markBootstrapStarted();
const bootstrap = bootstrapReviewSession();
benchmark?.markRendererStarted();
const renderer = await createCliRenderer({
  exitOnCtrlC: false,
  autoFocus: false,
  externalOutputMode: "passthrough",
  gatherStats: false,
  maxFps: 60,
  onDestroy: () => {
    process.exit(0);
  },
});

benchmark?.markRendererReady();

renderer.keyInput.on("keypress", (key) => {
  if (key.name === "`" || (key.ctrl && key.name === "l")) {
    renderer.console.toggle();
    return;
  }

  if (key.name === "y" && key.ctrl) {
    renderer.copyToClipboardOSC52(renderer.getSelection()?.getSelectedText() ?? "");
    return;
  }

  if (key.name === "c" && key.ctrl) {
    renderer.destroy();
  }
});

benchmark?.markRenderCalled();
createRoot(renderer as never).render(<AppRootWithBootstrap bootstrap={bootstrap} />);
benchmark?.markFirstPaint();

async function finalizeStartupBenchmark() {
  if (!benchmark) return;

  try {
    await bootstrap;
    benchmark.markBootstrapResolved();
  } catch (error) {
    benchmark.markBootstrapRejected(error);
  }

  await benchmark.writeSnapshot();
  renderer.destroy();
}

void finalizeStartupBenchmark();
