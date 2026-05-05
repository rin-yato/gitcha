import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { config } from "./index";

let dir: string;
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "gitcha-config-"));
  path = join(dir, "gitcha.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("config", () => {
  test("returns defaults for a missing file", () => {
    const loaded = config.fresh({ path });

    expect(loaded).toEqual({
      sidebar: { defaultOpen: true, defaultWidth: 40 },
      window: { paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 0 },
    });
  });

  test("reads partial config with zod defaults", () => {
    writeFileSync(
      path,
      JSON.stringify({
        sidebar: { defaultWidth: 52 },
        window: { paddingLeft: 7 },
      }),
    );

    const loaded = config.fresh({ path });

    expect(loaded).toEqual({
      sidebar: { defaultOpen: true, defaultWidth: 52 },
      window: { paddingTop: 0, paddingRight: 0, paddingBottom: 0, paddingLeft: 7 },
    });
  });

  test("caches get by path", () => {
    writeFileSync(path, JSON.stringify({ sidebar: { defaultWidth: 44 }, window: {} }));

    const first = config.get({ path });

    writeFileSync(path, JSON.stringify({ sidebar: { defaultWidth: 12 }, window: {} }));

    const second = config.get({ path });

    expect(first.sidebar.defaultWidth).toBe(44);
    expect(second.sidebar.defaultWidth).toBe(44);
  });

  test("fresh bypasses the cache", () => {
    writeFileSync(path, JSON.stringify({ sidebar: { defaultWidth: 44 }, window: {} }));

    config.get({ path });

    writeFileSync(path, JSON.stringify({ sidebar: { defaultWidth: 12 }, window: {} }));

    const loaded = config.fresh({ path });

    expect(loaded.sidebar.defaultWidth).toBe(12);
  });

  test("falls back to defaults for invalid JSON", () => {
    writeFileSync(path, "{ invalid json");

    const loaded = config.fresh({ path });

    expect(loaded.sidebar.defaultOpen).toBe(true);
    expect(loaded.sidebar.defaultWidth).toBe(40);
  });
});
