import { spawn } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { DEFAULT_THEME_ID, THEME_IDS, type ThemeId } from "@/themes";

export const MIN_SIDEBAR_WIDTH = 20;
export const MAX_SIDEBAR_WIDTH = 80;
export const DEFAULT_SIDEBAR_WIDTH = 40;

const CONFIG_FILE_NAME = "gitcha.json";

export type AppKeybindingId =
  | "openCommandPalette"
  | "moveUp"
  | "moveDown"
  | "toggleDiffView"
  | "refresh"
  | "openCompareDialog"
  | "stageSelectedFile"
  | "unstageSelectedFile"
  | "discardSelectedFile"
  | "shrinkSidebar"
  | "growSidebar"
  | "toggleSidebar"
  | "openThemeDialog"
  | "openStatusDialog"
  | "upgradeApp"
  | "quit";

export type AppKeybindings = Record<AppKeybindingId, string[]>;

export type AppConfig = {
  themeId: ThemeId;
  sidebarWidth: number;
  keybindings: AppKeybindings;
};

type AppConfigFile = {
  themeId?: string;
  sidebarWidth?: number;
  keybindings?: Partial<Record<AppKeybindingId, string | string[]>>;
};

export type KeyboardShortcutEvent = {
  name?: string;
  ctrl?: boolean;
  alt?: boolean;
  shift?: boolean;
  meta?: boolean;
};

const DEFAULT_KEYBINDINGS: AppKeybindings = {
  openCommandPalette: ["/"],
  moveUp: ["up", "k"],
  moveDown: ["down", "j"],
  toggleDiffView: ["space"],
  refresh: ["r"],
  openCompareDialog: ["v"],
  stageSelectedFile: ["s"],
  unstageSelectedFile: ["u"],
  discardSelectedFile: ["x"],
  shrinkSidebar: ["["],
  growSidebar: ["]"],
  toggleSidebar: ["\\"],
  openThemeDialog: ["t"],
  openStatusDialog: ["i"],
  upgradeApp: ["g"],
  quit: ["escape"],
};

export function createDefaultAppConfig(): AppConfig {
  return {
    themeId: DEFAULT_THEME_ID,
    sidebarWidth: DEFAULT_SIDEBAR_WIDTH,
    keybindings: cloneKeybindings(DEFAULT_KEYBINDINGS),
  };
}

export function getAppConfigPath(homeDirectory = homedir()): string {
  return join(homeDirectory, ".config", "gitcha", CONFIG_FILE_NAME);
}

export function normalizeThemeId(themeId: string | undefined | null): ThemeId {
  if (themeId === "opencode-light") return "opencode";
  if (themeId && THEME_IDS.includes(themeId as ThemeId)) return themeId as ThemeId;
  return DEFAULT_THEME_ID;
}

export function normalizeSidebarWidth(width: number | undefined | null): number {
  if (typeof width !== "number" || Number.isNaN(width)) return DEFAULT_SIDEBAR_WIDTH;
  return clampSidebarWidth(width);
}

export function clampSidebarWidth(width: number): number {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(width)));
}

export function normalizeShortcut(shortcut: string): string | null {
  const parts = shortcut
    .split(/\s*\+\s*/)
    .map((part) => normalizeShortcutToken(part))
    .filter((part): part is string => Boolean(part));

  if (parts.length === 0) return null;

  const modifiers = new Set(parts.slice(0, -1));
  const key = parts.at(-1);
  if (!key || isModifier(key)) return null;
  if (![...modifiers].every(isModifier)) return null;

  const normalizedParts = [
    modifiers.has("ctrl") ? "ctrl" : null,
    modifiers.has("alt") ? "alt" : null,
    modifiers.has("shift") ? "shift" : null,
    modifiers.has("meta") ? "meta" : null,
    key,
  ].filter((part): part is string => Boolean(part));

  return normalizedParts.join("+");
}

export function matchesShortcut(event: KeyboardShortcutEvent, shortcut: string): boolean {
  const normalizedShortcut = normalizeShortcut(shortcut);
  const eventShortcut = shortcutFromEvent(event);

  return Boolean(normalizedShortcut && eventShortcut && normalizedShortcut === eventShortcut);
}

export function matchesAnyShortcut(event: KeyboardShortcutEvent, shortcuts: string[]): boolean {
  return shortcuts.some((shortcut) => matchesShortcut(event, shortcut));
}

export function formatShortcutLabel(shortcuts: string[]): string | undefined {
  if (shortcuts.length === 0) return undefined;
  return shortcuts.join(", ");
}

export async function openAppConfig(
  options: { path?: string; homeDir?: string } = {},
): Promise<boolean> {
  const path = options.path ?? getAppConfigPath(options.homeDir);
  const editor = process.env.VISUAL?.trim() || process.env.EDITOR?.trim();

  if (!editor) return false;

  const [command, ...args] = editor.split(/\s+/).filter(Boolean);
  if (!command) return false;

  const opened = await new Promise<boolean>((resolve) => {
    const child = spawn(command, [...args, path], { stdio: "inherit" });

    child.on("error", () => resolve(false));
    child.on("close", (code) => resolve(code === 0));
  });

  return opened;
}

export function resolveAppConfig(config: unknown): AppConfig {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return createDefaultAppConfig();
  }

  const file = config as AppConfigFile;
  return {
    themeId: normalizeThemeId(file.themeId),
    sidebarWidth: normalizeSidebarWidth(file.sidebarWidth ?? DEFAULT_SIDEBAR_WIDTH),
    keybindings: normalizeKeybindings(file.keybindings),
  };
}

export async function loadAppConfig(
  options: { path?: string; homeDir?: string } = {},
): Promise<AppConfig> {
  const path = options.path ?? getAppConfigPath(options.homeDir);

  try {
    const exists = await fileExists(path);
    if (!exists) {
      const config = createDefaultAppConfig();
      await saveAppConfig(config, { path });
      return config;
    }

    const contents = await readFile(path, "utf8").catch(() => null);
    if (!contents) {
      const config = createDefaultAppConfig();
      await saveAppConfig(config, { path });
      return config;
    }

    return resolveAppConfig(JSON.parse(contents));
  } catch {
    return createDefaultAppConfig();
  }
}

export function serializeAppConfig(config: AppConfig): string {
  return JSON.stringify(
    {
      $schema: "https://raw.githubusercontent.com/rin-yato/gitcha/main/src/config.schema.json",
      themeId: config.themeId,
      sidebarWidth: config.sidebarWidth,
      keybindings: config.keybindings,
    },
    null,
    2,
  );
}

export async function saveAppConfig(
  config: AppConfig,
  options: { path?: string; homeDir?: string } = {},
): Promise<void> {
  const path = options.path ?? getAppConfigPath(options.homeDir);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${serializeAppConfig(config)}\n`);
}

function cloneKeybindings(keybindings: AppKeybindings): AppKeybindings {
  return Object.fromEntries(
    Object.entries(keybindings).map(([id, shortcuts]) => [id, [...shortcuts]]),
  ) as AppKeybindings;
}

function normalizeKeybindings(
  keybindings: AppConfigFile["keybindings"] | undefined,
): AppKeybindings {
  const normalized = cloneKeybindings(DEFAULT_KEYBINDINGS);

  for (const keybindingId of Object.keys(DEFAULT_KEYBINDINGS) as AppKeybindingId[]) {
    const value = keybindings?.[keybindingId];
    const shortcuts = normalizeShortcutList(value, normalized[keybindingId]);
    normalized[keybindingId] = shortcuts;
  }

  return normalized;
}

function normalizeShortcutList(
  value: string | string[] | undefined,
  fallback: string[],
): string[] {
  const values = Array.isArray(value) ? value : typeof value === "string" ? [value] : [];
  const normalized = values
    .map((shortcut) => normalizeShortcut(shortcut))
    .filter((shortcut): shortcut is string => Boolean(shortcut));

  return normalized.length > 0 ? Array.from(new Set(normalized)) : [...fallback];
}

function normalizeShortcutToken(token: string): string | null {
  if (token === " ") return "space";

  const normalized = token.trim().toLowerCase();
  if (!normalized) return null;

  switch (normalized) {
    case "esc":
    case "escape":
      return "escape";
    case "control":
      return "ctrl";
    case "cmd":
    case "command":
      return "meta";
    case "option":
      return "alt";
    case "enter":
      return "return";
    case "spacebar":
      return "space";
    default:
      return normalized;
  }
}

function isModifier(value: string): value is "ctrl" | "alt" | "shift" | "meta" {
  return value === "ctrl" || value === "alt" || value === "shift" || value === "meta";
}

function shortcutFromEvent(event: KeyboardShortcutEvent): string | null {
  if (!event.name) return null;

  const key = normalizeShortcutToken(event.name);
  if (!key) return null;

  const parts = [
    event.ctrl ? "ctrl" : null,
    event.alt ? "alt" : null,
    event.shift ? "shift" : null,
    event.meta ? "meta" : null,
    key,
  ].filter((part): part is string => Boolean(part));

  return parts.join("+");
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}
