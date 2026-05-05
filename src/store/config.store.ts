import { mergeProps } from "solid-js";
import { createStore } from "solid-js/store";

import { config } from "@/lib/config";
import type { AppConfig, ConfigArgs } from "@/lib/config/type";

const [configStore, setConfigStore] = createStore<AppConfig>(config.get());

export const $config = mergeProps(configStore, {
  action: {
    set: setConfigStore,
    refresh: (args: ConfigArgs = {}) => {
      const nextConfig = config.fresh(args);
      setConfigStore(nextConfig);
      return nextConfig;
    },
  },
});
