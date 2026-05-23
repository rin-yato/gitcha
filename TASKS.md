# Tasks

Parent plan: [PLAN.md](./PLAN.md)

---

## Slice 1: Review store + sidebar review mode [AFK]

### What to build

Create the `$review` store and wire the sidebar to respond to review mode. When review data is populated, the sidebar displays a single "Review" section with all changed files instead of the worktree sections, shows the review target as the header, and pressing `esc` exits back to worktree mode. The sidebar becomes always-visible (removing the "hide when empty" behavior). Worktree polling pauses while review mode is active.

### Acceptance criteria

- [x] `GitFileSection` type includes `"review"`
- [x] `$review.store` exists with `{ active, target, status, loading, error }` and `start`/`stop` actions
- [x] `start(target)` calls `git.review.status(target)` and populates the store
- [x] `stop()` clears all review state
- [x] Sidebar utils refactored to accept `CategorizedFiles | null` directly (existing `GitRepoStatus` signatures remain as wrappers)
- [x] Single-section builder returns one "Review" section with all files
- [x] Sidebar data source switches on `$review.active`
- [x] Sidebar header shows `Review: {baseLabel}` or `Review: {revisionRange}` in review mode
- [x] `esc` exits review mode (calls `$review.action.stop()`)
- [x] Sidebar always visible (no `hasChanges` gate)
- [x] 1s worktree polling pauses when `$review.active` is true
- [x] Existing worktree sidebar behavior unchanged
- [ ] Store has tests verifying state transitions

### Blocked by

None — can start immediately.

---

## Slice 2: Review dialogs + `v` keybinding [AFK]

### What to build

Pressing `v` opens the review flow. A mode selector dialog appears with two options ("Commit" / "Since Commit"). Choosing one pushes the commit picker dialog, which shows 30 recent commits and supports keyboard/mouse navigation and text filtering. Selecting a commit constructs the appropriate `GitReviewTarget`, calls `$review.action.start()`, and closes all dialogs, entering review mode.

### Acceptance criteria

- [x] `v` keybinding removed from sidebar `toggleViewMode`
- [x] `v` keybinding added in `tui.tsx` to open review dialog (guarded by `$dialog.stack.length === 0`)
- [x] ModeSelect dialog renders a `Select` with two options: "Commit" and "Since Commit"
- [x] Selecting a mode pushes CommitPicker dialog onto the stack
- [x] CommitPicker fetches 30 recent commits on mount and renders them as `SelectOption`s in compact format (`shortRef  title`)
- [x] Keyboard nav works: j/k, enter, esc to close
- [x] `onFilter` calls `git.commit.search(filter)` and updates the list with results
- [x] List shows empty while loading, populates when data arrives
- [x] On commit select: constructs `GitReviewTarget` (single-commit or base-commit), calls `$review.action.start(target)`, closes all dialogs
- [x] Pressing `v` while already in review mode re-opens the dialog to switch targets
- [x] `esc` closes dialog without affecting existing review state

### Blocked by

- Slice 1 (review store must exist for `$review.action.start()`)

---

## Slice 3: DiffPane review mode [AFK]

### What to build

When review mode is active and a file is selected, the diff pane calls `git.review.diff()` instead of `git.diff.get()` to fetch the commit-range diff. When no file is selected in review mode, the blank view shows "no changes in this review" instead of "worktree is clean".

### Acceptance criteria

- [x] Diff source is abstracted — picks `git.diff.get()` or `git.review.diff()` based on `$review.active`
- [x] `Diff` component accepts diff text as a prop/resource (no longer hardcodes `git.diff.get()`)
- [x] In review mode, selecting a file renders the commit-range diff correctly
- [x] Keyboard/mouse navigation works on review diffs
- [x] Blank view shows "no changes in this review" when `$review.active` and no file selected
- [x] Existing worktree diff behavior unchanged

### Blocked by

- Slice 1 (review store must exist; can be verified via manual store mutation without Slice 2)
