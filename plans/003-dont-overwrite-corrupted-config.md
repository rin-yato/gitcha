# Plan 003: Don't overwrite corrupted config file

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 248b1ac..HEAD -- src/lib/config/index.ts src/lib/config/type.ts`
> If these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `248b1ac`, 2026-06-13

## Why this matters

When `gitcha.json` exists but contains invalid JSON (e.g., a hand-edited typo), `ConfigManager.load()` returns a `ConfigParseError`. The `fresh()` method treats all errors the same and calls `createDefaultAppConfig(path)`, which does `writeFileSync(path, ...)` — overwriting the original file with defaults. The user loses all their settings silently. A file that's trivially fixable (fix the JSON typo) is destroyed.

## Current state

- `src/lib/config/index.ts` — config loading and cache (lines 30-51)
- `src/lib/config/type.ts` — `ConfigReadError` and `ConfigParseError` tagged errors (lines 51-71)

```typescript
// config/index.ts:30-37
fresh(options: ConfigArgs = {}): AppConfig {
  const path = options.path ?? this.getAppConfigPath(options.homeDir);

  const config = this.load(path).match({
    ok: (value) => value,
    err: () => this.createDefaultAppConfig(path),  // BUG: doesn't distinguish error types
  });

  this.cache = { path, config };
  return config;
}

// config/index.ts:42-51
private createDefaultAppConfig(path?: string): AppConfig {
  const config = configSchema.parse({});

  if (path) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);  // DESTRUCTIVE: overwrites existing file
  }

  return config;
}
```

```typescript
// config/type.ts:51-71 — two distinct error types already exist
export class ConfigReadError extends TaggedError("ConfigReadError")<{...}>() { ... }
export class ConfigParseError extends TaggedError("ConfigParseError")<{...}>() { ... }
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run typecheck`      | exit 0, no errors   |
| Tests     | `bun test src`           | all pass            |
| Lint      | `bun run check`          | exit 0              |
| Fix       | `bun run fix`            | exit 0              |

## Scope

**In scope**: `src/lib/config/index.ts` and `src/lib/config/config.test.ts`.

**Out of scope**: `src/lib/config/type.ts` — the error types are correct. Do not modify.

## Git workflow

- Branch: `advisor/003-dont-overwrite-corrupted-config`
- Commit message: `fix(config): preserve corrupted config file instead of overwriting it`

## Steps

### Step 1: Update `fresh()` to branch on error type

In `src/lib/config/index.ts`, modify the `fresh()` method. Distinguish `ConfigReadError` (file doesn't exist — create it) from `ConfigParseError` (file exists but is invalid — return defaults in-memory and warn, do NOT overwrite).

Replace lines 30-37:

```typescript
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
    // File missing — safe to create
    const config = this.createDefaultAppConfig(path);
    this.cache = { path, config };
    return config;
  }

  // ConfigParseError — file exists but is invalid. Return defaults
  // in-memory without overwriting the on-disk file so the user can
  // fix their typo and restart.
  const config = configSchema.parse({});
  this.cache = { path, config };
  return config;
}
```

The imports for `ConfigReadError` and `ConfigParseError` are already imported at `config/index.ts:9-12`. Verify `Result` is imported (it is, line 5).

**Verify**: `bun run typecheck` → exit 0

### Step 2: Add test for config parse error not overwriting

In `src/lib/config/config.test.ts`, add a test case that confirms a corrupted config file is preserved. Model after existing tests in that file.

```typescript
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

// ... existing imports and tests ...

describe("config parse error handling", () => {
  let tmpDir: string;
  let configPath: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `gitcha-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
    configPath = join(tmpDir, "gitcha.json");
  });

  afterEach(() => {
    // Clean up — use rmSync with recursive
    try { require("node:fs").rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  test("does not overwrite a file with invalid JSON", () => {
    const original = "{ invalid json content !!! }";
    writeFileSync(configPath, original);

    const config = new ConfigManager().get({ path: configPath, homeDir: tmpDir });

    // Config should be defaults (isValid JSON parse gave us defaults)
    expect(config.theme).toBeDefined();

    // The on-disk file should be untouched
    const onDisk = readFileSync(configPath, "utf8");
    expect(onDisk).toBe(original);
  });

  test("creates config file when it does not exist", () => {
    const config = new ConfigManager().get({ path: configPath, homeDir: tmpDir });
    expect(config.theme).toBeDefined();

    const onDisk = readFileSync(configPath, "utf8");
    const parsed = JSON.parse(onDisk);
    expect(parsed).toHaveProperty("theme");
  });
});
```

Note: You may need to export `ConfigManager` from the config module (it's currently only exported as `config` instance). Add `export { ConfigManager }` to `src/lib/config/index.ts` if not already exported.

**Verify**: `bun test src/lib/config/` → all tests pass, including the 2 new ones

### Step 3: Run full suite and lint

**Verify**: `bun test src` → all pass
**Verify**: `bun run fix` → exit 0

## Test plan

- New test in `src/lib/config/config.test.ts`: "does not overwrite a file with invalid JSON" — verifies the on-disk file is unchanged after loading an invalid config.
- New test: "creates config file when it does not exist" — verifies the existing happy path still works.
- Pattern: follow existing test style in `config.test.ts` (uses `bun:test`, `expect`).

## Done criteria

- [ ] `bun run typecheck` exits 0
- [ ] `bun test src` exits 0, including 2 new config tests
- [ ] `bun run fix` exits 0
- [ ] No files outside `src/lib/config/index.ts` and `src/lib/config/config.test.ts` are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The code at `config/index.ts:30-51` doesn't match the excerpts.
- `ConfigManager` is not exported and adding the export causes issues (it shouldn't; it's a class).
- The test file directory for tmpdir doesn't work on your platform — use a different temp directory.

## Maintenance notes

- If future config features add new error types to `load()`, the `fresh()` method error switch must handle them explicitly.
- The `ConfigParseError` now produces a non-fatal fallback; callers should still surface the parse error to the user (future UX improvement, not in this plan).
