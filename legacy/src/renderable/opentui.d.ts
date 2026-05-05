import type { ChangesRenderable } from "@/renderable/changes";

declare module "@opentui/react" {
  interface OpenTUIComponents {
    changes: typeof ChangesRenderable;
  }
}
