# Changes AGENTS.md

## Agent Workflow

- Start by inspecting the relevant source files, tests, and configs before editing.
- Prefer the smallest correct change.
- Preserve any unrelated local changes already in the worktree.
- Use `apply_patch` for manual file edits.
- Add or update tests when behavior changes.
- Run the narrowest useful verification first, then the broader check before handing off.
- Do not use `bun run dev`; it is interactive and blocks the session.

## Repository Map

- `src/component/` - UI components and feature surfaces.
- `src/context/` - shared state, providers, and app-level hooks.
- `src/lib/` - git/fs/tree-sitter utilities and other non-UI logic.
- `src/themes/` - theme data and theme types.
- `scripts/` - build, install, and benchmark scripts.

## Commands

Run commands from the repository root with `bun run <script>` unless noted otherwise.

### Verification

- `bun test` - run the full test suite. Use this for behavior changes and before final handoff.
- `bun run ci` - run Biome check and TypeScript typecheck (`biome check && tsc --noEmit`).
- `bun run fix` - auto-fix formatting and lint issues (`biome check --write --unsafe`).

### Build and Install

- `bun run build` - compile the CLI to `dist/changes`.
- `bun run install` - build if needed, copy the binary to `~/.local/bin/changes`, and create the `ch` alias symlink.

### Benchmarks

- `bun run bench` - run the startup benchmark with the default fixture.
- `bun run bench:repo` - benchmark the default `https://github.com/anomalyco/opentui` fixture explicitly.
- `bun run bench:json --out=benchmarks/latest.json` - write a machine-readable benchmark report.
- `bun run bench:latest` - refresh `benchmarks/latest.json` with the current results.
- `bun run bench:compare` - compare current results against `benchmarks/latest.json`.
- `bun run bench:reset-fixture` - clear the cached benchmark repository and fixture state.

## Code Conventions

- TypeScript is strict; keep types explicit where inference is unclear.
- Prefer `const`, pure helpers, and immutable transforms.
- Avoid `let` and in-place mutation unless it meaningfully simplifies the code.
- Keep functions small and local unless the logic is clearly reusable.
- Use `@/` path aliases for imports under `src/`.
- JSX uses `@opentui/react` as the import source, not `react`.
- Follow Biome import ordering and formatting.
- Prefer kebab-case for new component files and folders.
- Keep comments brief and only for non-obvious logic.

## Project Notes

- The app always works against the current real git repository context
- The build bundles the Tree-sitter worker, so `bun run build` should be used to verify changes that touch parser or build wiring.
- For perf work, focus on repo detection, status refresh, file-tree construction, and first diff load.
