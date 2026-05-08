# Gitcha AGENTS.md

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
- `src/store/` - shared SolidJS stores and reactive state (replaced `src/context/`).
- `src/lib/` - git/fs/tree-sitter utilities and other non-UI logic.
- `src/lib/themes/` - theme data and theme types (was `src/themes/`).
- `scripts/` - build and install scripts.

## Commands

Run commands from the repository root with `bun run <script>` unless noted otherwise.

### Verification

Always run `bun run fix`, instead of `bun run ci` or `bun run check`. This way it does both checks and fix any simple format or lint issues.

- `bun test` - run the full test suite. Use this for behavior changes and before final handoff.
- `bun run ci` - run Biome check and TypeScript typecheck (`biome check && tsc --noEmit`).
- `bun run fix` - auto-fix formatting and lint issues (`biome check --write --unsafe`).

### Build and Install

- `bun run build` - compile the CLI to `dist/gitcha`.
- `bun run setup` - build if needed, will run `bun link`, then we can use the `gitcha` cmd.

## Code Conventions

- TypeScript is strict; keep types explicit where inference is unclear.
- Prefer `const`, pure helpers, and immutable transforms.
- Avoid `let` and in-place mutation unless it meaningfully simplifies the code.
- Keep functions small and local unless the logic is clearly reusable.
- Use `@/` path aliases for imports under `src/`.
- JSX uses `@opentui/solid` as the import source (SolidJS, not React).
- Follow Biome import ordering and formatting.
- Prefer kebab-case for new component files and folders.
- Keep comments brief and only for non-obvious logic.

## Error Handling

All domain and I/O errors must use `better-result` typed results instead of thrown exceptions.

- **Async operations**: wrap with `Result.tryPromise({ try: async () => ..., catch: (e) => normalizeError(e) })`.
- **Sync operations**: wrap with `Result.try({ try: () => ..., catch: (e) => normalizeError(e) })`.
- **Return type**: prefer `Result<T, Error>` over `Promise<T>` or `T` whenever a call can fail.
- **Never catch silently**: always propagate the error as a `Result.err(...)` so callers can decide.
- **Consumer pattern**: check with `Result.isOk(result)` / `Result.isError(result)` and branch explicitly.
- **Tagged errors**: use `TaggedError` from `better-result` when the error type matters downstream.

Examples:

```typescript
import { Result, TaggedError } from "better-result";

class CopyFailedError extends TaggedError("CopyFailed") {
  constructor(readonly cause: unknown) {
    super("Clipboard copy failed");
  }
}

async function copy(text: string): Promise<Result<void, CopyFailedError>> {
  return Result.tryPromise({
    try: async () => { /* ... */ },
    catch: (e) => new CopyFailedError(e),
  });
}

const result = await copy("hello");
if (Result.isOk(result)) {
  $toast.action.success("Copied");
} else {
  $toast.action.error(result.error.message);
}
```

## Project Notes

- The app always works against the current real git repository context.
- The build bundles the Tree-sitter worker, so `bun run build` should be used to verify changes that touch parser or build wiring.
