import type { DiffRenderable } from "@opentui/core";

declare module "@opentui/solid" {
  interface OpenTUIComponents {
    diff: typeof DiffRenderable;
  }
}
