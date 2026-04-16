import fs from "node:fs/promises";

export type StartupBenchmarkSnapshot = {
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

type StartupBenchmarkState = Omit<StartupBenchmarkSnapshot, "totalMs">;

export type StartupBenchmarkRecorder = {
  markBootstrapStarted: () => void;
  markRendererStarted: () => void;
  markRendererReady: () => void;
  markRenderCalled: () => void;
  markBootstrapResolved: () => void;
  markBootstrapRejected: (error: unknown) => void;
  markFirstPaint: () => void;
  writeSnapshot: () => Promise<void>;
};

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Unknown";
}

export function createStartupBenchmarkRecorder(outputPath: string): StartupBenchmarkRecorder {
  const startedAt = performance.now();
  const state: StartupBenchmarkState = {
    bootstrapStartedMs: 0,
    rendererStartedMs: 0,
  };
  let wroteSnapshot = false;

  const elapsed = () => performance.now() - startedAt;

  const snapshot = (): StartupBenchmarkSnapshot => ({
    ...state,
    totalMs: elapsed(),
  });

  const writeSnapshot = async () => {
    if (wroteSnapshot) return;
    if (state.firstPaintMs === undefined) return;
    if (state.bootstrapResolvedMs === undefined && state.bootstrapRejectedMs === undefined) {
      return;
    }

    wroteSnapshot = true;
    await fs.writeFile(outputPath, `${JSON.stringify(snapshot(), null, 2)}\n`);
  };

  const markAndFlush = (mutate: () => void) => {
    mutate();
    void writeSnapshot();
  };

  return {
    markBootstrapStarted: () => {
      markAndFlush(() => {
        state.bootstrapStartedMs = elapsed();
      });
    },
    markRendererStarted: () => {
      markAndFlush(() => {
        state.rendererStartedMs = elapsed();
      });
    },
    markRendererReady: () => {
      markAndFlush(() => {
        state.rendererReadyMs ??= elapsed();
      });
    },
    markRenderCalled: () => {
      markAndFlush(() => {
        state.renderCalledMs ??= elapsed();
      });
    },
    markBootstrapResolved: () => {
      markAndFlush(() => {
        state.bootstrapResolvedMs ??= elapsed();
      });
    },
    markBootstrapRejected: (error: unknown) => {
      markAndFlush(() => {
        state.bootstrapRejectedMs ??= elapsed();
        state.bootstrapError ??= formatError(error);
      });
    },
    markFirstPaint: () => {
      markAndFlush(() => {
        state.firstPaintMs ??= elapsed();
      });
    },
    writeSnapshot,
  };
}
