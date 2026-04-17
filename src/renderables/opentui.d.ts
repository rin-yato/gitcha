import type { ChangesRenderable } from "@/renderables/changes-renderable";

declare module "@opentui/react" {
  interface OpenTUIComponents {
    changes: typeof ChangesRenderable;
  }
}
