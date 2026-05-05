import { beforeAll } from "bun:test";

import { registerRenderables } from "@/renderable/register";

registerRenderables();

beforeAll(() => {
  const globalAct = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  globalAct.IS_REACT_ACT_ENVIRONMENT = true;
});
