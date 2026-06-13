# Plan 009: Fix README config documentation to match actual schema

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 248b1ac..HEAD -- README.md src/lib/config/type.ts`
> If these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `248b1ac`, 2026-06-13

## Why this matters

The README `Configuration` section (lines 25-37) lists config keys that don't match the actual Zod schema in `src/lib/config/type.ts:17-42`. Users who follow the README write invalid config and get no error — because corrupted config is silently overwritten with defaults (the bug fixed in plan 003). The schema URL in the README also points to a nonexistent `legacy/` directory. This plan fixes the documentation to match reality.

## Current state

- `README.md:25-37` — Configuration section (wrong keys, dead schema URL)
- `src/lib/config/type.ts:17-42` — actual Zod schema (source of truth)

```markdown
# README.md:25-37 — CURRENT (wrong)
## Configuration

`gitcha` reads config from `~/.config/gitcha/gitcha.json` on startup.

Supported keys:

- `themeId`
- `sidebarWidth`
- `keybindings`

The generated config includes a `$schema` field pointing at:

`https://raw.githubusercontent.com/rin-yato/gitcha/main/legacy/src/config.schema.json`

If you want editor validation, point your local config file at that schema URL.
```

```typescript
// config/type.ts:17-42 — ACTUAL schema (correct)
export const configSchema = z.object({
  theme: z.enum(THEME_IDS as [ThemeId, ...ThemeId[]]).default(DEFAULT_THEME_ID),
  themeMode: z.enum(["light", "dark"]).default(DEFAULT_THEME_MODE),
  sidebar: z.object({
    defaultOpen: z.boolean().default(DEFAULT_SIDEBAR_DEFAULT_OPEN),
    defaultWidth: z.number().int().default(DEFAULT_SIDEBAR_DEFAULT_WIDTH),
  }).default({ ... }),
  window: z.object({
    paddingTop: z.number().int().default(0),
    paddingRight: z.number().int().default(0),
    paddingBottom: z.number().int().default(0),
    paddingLeft: z.number().int().default(0),
  }).default({ ... }),
});
```

Mismatches:
- README says `themeId` → schema has `theme`
- README says `sidebarWidth` → schema has `sidebar.defaultWidth`
- README says `keybindings` → no such key in schema
- Schema has `themeMode`, `sidebar.defaultOpen`, `window.padding*` → not in README
- Schema URL `legacy/src/config.schema.json` → that path doesn't exist in the repo

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Tests     | `bun test src`           | all pass            |
| Lint      | `bun run check`          | exit 0              |

## Scope

**In scope**: `README.md` only — update the Configuration section.

**Out of scope**: `src/lib/config/type.ts`, `src/lib/config/index.ts`, any source code.

## Git workflow

- Branch: `advisor/009-fix-readme-config-docs`
- Commit message: `docs: fix README config keys to match actual schema`

## Steps

### Step 1: Update the Configuration section

Replace the Configuration section in `README.md` (lines 23-38) with accurate documentation:

```markdown
## Configuration

`gitcha` reads config from `~/.config/gitcha/gitcha.json` on startup.

Supported keys:

| Key | Type | Default | Description |
|---|---|---|---|
| `theme` | string | `"github-light"` | Theme ID (see available themes) |
| `themeMode` | `"light"` \| `"dark"` | `"light"` | Light or dark mode |
| `sidebar.defaultOpen` | boolean | `true` | Whether sidebar starts open |
| `sidebar.defaultWidth` | number | `40` | Default sidebar width in columns |
| `window.paddingTop` | number | `0` | Top padding |
| `window.paddingRight` | number | `0` | Right padding |
| `window.paddingBottom` | number | `0` | Bottom padding |
| `window.paddingLeft` | number | `0` | Left padding |
```

Remove the `$schema` reference and URL line entirely — the `legacy/` directory doesn't exist and the generated config file doesn't actually include a `$schema` field (check `src/lib/config/index.ts:47` — `JSON.stringify(config, null, 2)` without schema).

**Verify**: Read the modified README section and confirm each key matches `src/lib/config/type.ts:17-42`.

### Step 2: Verify

**Verify**: `bun test src` → all pass (no source changes, so test impact is zero)
**Verify**: `bun run check` → no markdown lint issues

## Test plan

No tests needed — documentation-only change.

## Done criteria

- [ ] README Configuration section lists keys matching `config/type.ts`
- [ ] No mention of `themeId`, `sidebarWidth`, or `keybindings` as config keys
- [ ] The dead schema URL is removed
- [ ] Only `README.md` is modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- The README doesn't match the excerpt (it's been updated since this plan was written).
- The actual schema in `config/type.ts` has changed from what's shown here — check it first.
- A theme list or config schema generation step is requested — that's out of scope; this is documentation only.

## Maintenance notes

- When new config keys are added to `config/type.ts`, update this README table.
- If a config schema JSON file is ever generated and committed, the `$schema` URL can be re-added then, pointing at the correct path.
