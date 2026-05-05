import { extend } from "@opentui/react";

import { ChangesRenderable } from "@/renderable/changes";

export function registerRenderables() {
  extend({
    changes: ChangesRenderable,
  });
}
