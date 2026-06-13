# Plan 011: Wire diff-view toggle and runtime theme switching

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 248b1ac..HEAD -- src/component/diff-pane/diff.tsx src/context/theme.tsx src/tui.tsx`
> If these files changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: direction
- **Planned at**: commit `248b1ac`, 2026-06-13

## Why this matters

Two features the architecture already supports but aren't exposed to the user:

1. **Diff view toggle (unified/split)**: `VirtualizedDiffRenderable` has a `view` property with getter/setter (`virtualized-diff/index.tsx:1121-1137`) that switches between `"unified"` and `"split"` views and triggers a full rebuild. But `diff.tsx:24` always renders with the default (unified). No keybinding to toggle.

2. **Runtime theme switching**: `ThemeProvider` initializes from config at module load time (`theme.tsx:27-28`). The store's setter is named `_setState` (underscore-prefixed, suggesting "internal"), and `ThemeApi` exposes only `{ state }` — no `setTheme` or `setMode` action. Users must restart to change themes.

## Current state

- `src/component/diff-pane/diff.tsx` — always renders unified view (line 24)
- `src/component/virtualized-diff/index.tsx:1121-1137` — `view` property already supports both modes
- `src/context/theme.tsx:27-46` — theme frozen at import time, `_setState` unused
- `src/tui.tsx` — keybindings registration

```typescript
// diff.tsx:24 — always unified
<virtualized_diff
  width="100%"
  height="100%"
  diff={props.diff}
  syncScroll
  // ... no `view="split"` prop
/>
```

```typescript
// virtualized-diff/index.tsx:1121-1137 — view setter already works
public set view(value: "unified" | "split") {
  if (this._view !== value) {
    this._view = value;
    this.flexDirection = value === "split" ? "row" : "column";
    // ... resets window and rebuilds ...
  }
}
```

```typescript
// theme.tsx:27-28, 38-48 — frozen at import, no setter exposed
const cfg = config.get();
const INITIAL_STATE: ThemeState = createThemeState(cfg.theme, cfg.themeMode);

export const ThemeProvider: ParentComponent<...> = (props) => {
  const [state, _setState] = createStore<ThemeState>({ ...INITIAL_STATE, ...props.initialState });
  const api: ThemeApi = { state };  // No setTheme/setMode
  // ...
};
```

## Commands you will need

| Purpose   | Command                  | Expected on success |
|-----------|--------------------------|---------------------|
| Typecheck | `bun run typecheck`      | exit 0, no errors   |
| Tests     | `bun test src`           | all pass            |
| Lint      | `bun run check`          | exit 0              |
| Fix       | `bun run fix`            | exit 0              |

## Scope

**In scope**:
- `src/component/diff-pane/diff.tsx` — add `view` prop wiring
- `src/component/diff-pane/index.tsx` — add diff view state and keybinding
- `src/context/theme.tsx` — add `setTheme` and `setMode` actions, expose `_setState`
- `src/tui.tsx` — add keybinding for diff view toggle
- `src/lib/config/index.ts` — call `config.get()` inside ThemeProvider (not at module level)

**Out of scope**:
- `src/component/virtualized-diff/index.tsx` — no changes (already works)
- The sidebar, ex-command, any other components
- Writing new themes — only switching between existing themes
- Persisting theme choice to config file — this plan does in-memory switching only

## Git workflow

- Branch: `advisor/011-diffview-theme-toggle`
- Commit message: `feat: wire diff-view toggle and runtime theme switching`

## Steps

### Step 1: Add runtime theme switching to ThemeProvider

In `src/context/theme.tsx`:

1. Import `getTheme` and `createThemeState` (already imported). Add import for `config`.
2. Move `createThemeState` call inside the Provider body instead of at module level.
3. Add `setTheme` and `setMode` actions to `ThemeApi`.
4. Remove the `_` prefix from the setter name.

```typescript
// theme.tsx — updated Provider

type ThemeApi = {
  state: Store<ThemeState>;
  setTheme: (themeId: ThemeId) => void;
  setMode: (mode: ThemeMode) => void;
};

export const ThemeProvider: ParentComponent<{
  initialState?: Partial<ThemeState>;
}> = (props) => {
  const cfg = config.get();
  const [state, setState] = createStore<ThemeState>(
    createThemeState(cfg.theme, cfg.themeMode),
  );

  const api: ThemeApi = {
    state,
    setTheme: (themeId: ThemeId) => {
      setState(createThemeState(themeId, state.mode));
    },
    setMode: (mode: ThemeMode) => {
      setState(createThemeState(state.themeId, mode));
    },
  };

  return <ThemeContext.Provider value={api}>{props.children}</ThemeContext.Provider>;
};
```

Remove the module-level `const cfg = config.get();` and `CREATE_STATE` lines (27-28).

**Verify**: `bun run typecheck` → exit 0

### Step 2: Add diff view state and toggle to DiffPane

In `src/component/diff-pane/index.tsx`:

1. Add a `createSignal` for the current view:

```typescript
import { createSignal } from "solid-js";

// Inside DiffPane:
const [diffView, setDiffView] = createSignal<"unified" | "split">("unified");
```

2. Pass `view={diffView()}` to the `<Diff>` component. Update the `Diff` component in `diff.tsx` to accept an optional `view` prop:

```typescript
// diff.tsx
interface DiffProps {
  filePath: string;
  diff: string;
  view?: "unified" | "split";
}

export function Diff(props: DiffProps) {
  // ...
  return (
    <box ...>
      <text ...>{props.filePath}</text>
      <virtualized_diff
        view={props.view}
        // ... rest of props unchanged
      />
    </box>
  );
}
```

3. Add a keybinding for toggling the view. Register it in `DiffPane` using `useBindings`:

```typescript
import { useBindings } from "@opentui/keymap/solid";

// Inside DiffPane, add after existing code:
useBindings(() => ({
  commands: [{
    name: "diff.toggle-view",
    run() {
      setDiffView(v => v === "unified" ? "split" : "unified");
    },
  }],
  bindings: [{
    key: "d",
    cmd: "diff.toggle-view",
    desc: "Toggle diff view",
  }],
}));
```

**Verify**: `bun run typecheck` → exit 0

### Step 3: Run tests and lint

**Verify**: `bun test src` → all pass
**Verify**: `bun run fix` → exit 0

## Test plan

No new tests required. The changes are wiring of existing functionality through new UI controls. The existing tests confirm no regression.

Manual verification:
1. Run `gitcha` in a repo, press `d` — diff view toggles between unified and split.
2. The theme switching can be tested programmatically (no keybinding added for theme in this plan — just the API).

## Done criteria

- [ ] `ThemeApi` exposes `setTheme` and `setMode`
- [ ] `DiffPane` has a toggleable `view` state with `d` keybinding
- [ ] `bun run typecheck` exits 0
- [ ] `bun test src` exits 0
- [ ] `bun run fix` exits 0
- [ ] Only files in "In scope" are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back if:
- `VirtualizedDiffRenderable.view` setter doesn't exist or has a different signature. Check `virtualized-diff/index.tsx:1121-1137`.
- The `ThemeApi` change causes type errors in `tui.tsx` or other consumers — check all `useTheme()` call sites: `rg "useTheme" src/`.
- Module-level config cache causes issues when moving `config.get()` inside the provider — `config.get()` has caching, so it should be fine as long as the provider is only instantiated once (it is, in `tui.tsx:82`).

## Maintenance notes

- Theme switching is in-memory only. Persisting the user's theme choice to `gitcha.json` would require `config.fresh()` or a config write API (out of scope).
- The `view` prop on `<virtualized_diff>` triggers a full rebuild through the `VirtualizedDiffRenderable.view` setter. This is correct — it resets the virtual window state.
