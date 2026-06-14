import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

import { Result } from "better-result";

import {
  type AppConfig,
  type ConfigArgs,
  ConfigParseError,
  ConfigReadError,
  configSchema,
} from "./type";

const CONFIG_FILE_NAME = "gitcha.json";

class ConfigManager {
  private cache: { path: string; config: AppConfig } | null = null;

  get(options: ConfigArgs = {}): AppConfig {
    const path = options.path ?? this.getAppConfigPath(options.homeDir);

    if (this.cache?.path === path) {
      return this.cache.config;
    }

    return this.fresh({ ...options, path });
  }

  fresh(options: ConfigArgs = {}): AppConfig {
    const path = options.path ?? this.getAppConfigPath(options.homeDir);

    const loaded = this.load(path);
    if (Result.isOk(loaded)) {
      const config = loaded.value;
      this.cache = { path, config };
      return config;
    }

    const error = loaded.error;
    if (error instanceof ConfigReadError) {
      const config = this.createDefaultAppConfig(path);
      this.cache = { path, config };
      return config;
    }

    const config = configSchema.parse({});
    this.cache = { path, config };
    return config;
  }

  private createDefaultAppConfig(path?: string): AppConfig {
    const config = configSchema.parse({});

    if (path) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
    }

    return config;
  }

  private load(path: string) {
    return Result.try({
      try: () => readFileSync(path, "utf8"),
      catch: (cause) => new ConfigReadError({ path, cause }),
    })
      .andThen((contents) =>
        Result.try({
          try: () => JSON.parse(contents),
          catch: (cause) => new ConfigParseError({ path, cause }),
        }),
      )
      .andThen((raw) => this.validateAndMerge(path, raw));
  }

  private validateAndMerge(path: string, config: unknown) {
    const parsed = configSchema.safeParse(config ?? {});

    if (!parsed.success) {
      return Result.err(new ConfigParseError({ path, cause: parsed.error }));
    }

    return Result.ok(parsed.data);
  }

  private getAppConfigPath(homeDirectory = homedir()): string {
    return join(homeDirectory, ".config", "gitcha", CONFIG_FILE_NAME);
  }
}

export { ConfigManager };
export const config = new ConfigManager();
