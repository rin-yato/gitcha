# Changes AGENTS.md

## Dev Commands

```sh
bun test              # Bun test runner (USE THIS to verify changes)
bun run ci            # biome check && tsc --noEmit
bun run fix           # biome check --write --unsafe
bun run build         # Compiles to dist/changes (Bun compile)
bun run install       # Builds if needed, installs to ~/.local/bin/changes
bun run bench         # Writes startup timing JSON for comparison
bun run bench:latest  # Stores the latest benchmark results for comparison `latest.json`
bun run bench:compare # Compares the latest benchmark results to the previous stored results, showing diffs
```

**Never run `bun run dev`** — this starts an interactive TUI app that will block. If you need 
to see the current state, or test an issue/bug, you need to run the test command. If no test is suitable for your investigation
that mean our test case isn't good enough. You should first add the test to verify what you expect and run them.

## Key Quirks

- **JSX import source**: Uses `@opentui/react`, not `react`. tsconfig sets `jsxImportSource: "@opentui/react"`
- **Real git only**: the app always uses the current repository context; there is no fake-git dev mode.
- **Build bundles tree-sitter worker**: `scripts/build.ts` copies `node_modules/@opentui/core/parser.worker.js` into the binary using Bun's compile feature
- **Biome import order**: Organized groups in biome.json: `@opentui/**` → `@/libs/**` → `@/hooks/**` → etc.

## Style

- Prefer `const`, pure helpers, and immutable transforms in new code. Avoid `let` and in-place mutation when a functional alternative is practical; `remeda` or `better-result` can help keep control flow functional.

## Perf

- Use `bun run bench:repo` to capture startup timing baselines. The default fixture repo is `https://github.com/anomalyco/opentui` and is cached in your user cache directory, outside the repo tree.
- Use `bun run bench:json --out=benchmarks/latest.json` for a machine-readable report.
- Use `bun run bench:reset-fixture` to drop the cached repo and fixture state.
- Keep measurements focused on repo detection, status refresh, file-tree build, and first diff load.

## Path Alias

`@/*` → `./src/*`
