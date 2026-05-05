import { DEFAULT_THEME_ID, THEME_IDS, type ThemeId, type ThemeMode } from "@/lib/themes";

import { TaggedError } from "better-result";
import { z } from "zod";

export const DEFAULT_SIDEBAR_DEFAULT_OPEN = true;
export const DEFAULT_SIDEBAR_DEFAULT_WIDTH = 40;
export const DEFAULT_WINDOW_PADDING = {
  TOP: 0,
  RIGHT: 0,
  BOTTOM: 0,
  LEFT: 0,
} as const;

export const DEFAULT_THEME_MODE: ThemeMode = "light";

export const configSchema = z.object({
  theme: z.enum(THEME_IDS as [ThemeId, ...ThemeId[]]).default(DEFAULT_THEME_ID),
  themeMode: z.enum(["light", "dark"]).default(DEFAULT_THEME_MODE),
  sidebar: z
    .object({
      defaultOpen: z.boolean().default(DEFAULT_SIDEBAR_DEFAULT_OPEN),
      defaultWidth: z.number().int().default(DEFAULT_SIDEBAR_DEFAULT_WIDTH),
    })
    .default({}),
  window: z
    .object({
      paddingTop: z.number().int().default(DEFAULT_WINDOW_PADDING.TOP),
      paddingRight: z.number().int().default(DEFAULT_WINDOW_PADDING.RIGHT),
      paddingBottom: z.number().int().default(DEFAULT_WINDOW_PADDING.BOTTOM),
      paddingLeft: z.number().int().default(DEFAULT_WINDOW_PADDING.LEFT),
    })
    .default({}),
});

export type AppConfig = z.infer<typeof configSchema>;

export type ConfigArgs = {
  path?: string;
  homeDir?: string;
};

export class ConfigReadError extends TaggedError("ConfigReadError")<{
  path: string;
  message: string;
  cause: unknown;
}>() {
  constructor(args: { path: string; cause: unknown }) {
    const message = args.cause instanceof Error ? args.cause.message : String(args.cause);
    super({ ...args, message: `Failed to read config from ${args.path}: ${message}` });
  }
}

export class ConfigParseError extends TaggedError("ConfigParseError")<{
  path: string;
  message: string;
  cause: unknown;
}>() {
  constructor(args: { path: string; cause: unknown }) {
    const message = args.cause instanceof Error ? args.cause.message : String(args.cause);
    super({ ...args, message: `Failed to parse config from ${args.path}: ${message}` });
  }
}
