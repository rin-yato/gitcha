# Changes AGENTS.md

## Dev Commands

```sh
bun test             # Bun test runner (USE THIS to verify changes)
bun run ci           # biome check && tsc --noEmit
bun run fix          # biome check --write --unsafe
bun run build        # Compiles to dist/changes (Bun compile)
bun run install      # Builds if needed, installs to ~/.local/bin/changes
```

**Never run `bun run dev` or `bun run dev:git`** — these start interactive TUI apps that will block. If you need 
to see the current state, or test an issue/bug, you need to run the test command. If no test is suitable for your investigation
that mean our test case isn't good enough. You should first add the test to verify what you expect and run them.

## Key Quirks

- **JSX import source**: Uses `@opentui/react`, not `react`. tsconfig sets `jsxImportSource: "@opentui/react"`
- **Fake git for dev**: `USE_FAKE_GIT=1` (default in `dev` script) enables `createFakeGitClient()` with mock data. No git repo required.
- **Build bundles tree-sitter worker**: `scripts/build.ts` copies `node_modules/@opentui/core/parser.worker.js` into the binary using Bun's compile feature
- **Biome import order**: Organized groups in biome.json: `@opentui/**` → `@/libs/**` → `@/hooks/**` → etc.

## Path Alias

`@/*` → `./src/*`

