import type { DiffRenderable } from "@opentui/core";

import type { VirtualizedDiffRenderable } from "./component/virtualized-diff";

declare module "@opentui/solid" {
  interface OpenTUIComponents {
    diff: typeof DiffRenderable;
    virtualized_diff: typeof VirtualizedDiffRenderable;
  }
}
