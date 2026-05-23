# Review Mode UI Plan

## Q&A Summary

### Q1: How does a user enter review mode?
**A:** Keybinding `v` triggers a dialog asking to pick between two modes: "Commit" and "Since Commit", then commit selection.

### Q2: What does the UI look like after a review is initiated?
**A:** Swap the sidebar to show review files instead of worktree files. Press `esc` to exit back to worktree mode.

### Q3: How does commit selection work after choosing the mode?
**A:** Text input + filtered list hybrid. Filter commits from the log, or type an arbitrary ref and hit enter.

### Q4: Is "Since Commit" always vs. the worktree?
**A:** Yes. "Commit" = single commit review (what changed in that commit). "Since Commit" = base commit vs. worktree.

### Q5: Where does the review state live?
**A:** New `$review.store` (separate from `$git.store`). Clean separation, no polling conflict, unambiguous fields.

### Q6: How does the commit selection dialog work step-by-step?
**A:** List starts with 30 recent commits, user can scroll and pick or type to filter. Mode selection and commit selection are two separate dialogs pushed on the stack.

### Q7: What happens after commit selection?
**A:** Dialog closes, `$review.action.start(target)` is called, sidebar switches to review mode.

### Q8: What commit info does the picker list show?
**A:** Compact format: `shortRef` + `title` (e.g., `a1b2c3d  Fix login bug`).

### Q9: How does DiffPane switch between worktree and review diff?
**A:** Abstracted diff source helper. Checks `$review.active` to pick between `git.diff.get()` and `git.review.diff()`.

### Q10: What happens to the existing `v` keybinding?
**A:** Remove `v` → `sidebar.view.toggle`. `v` is repurposed for entering review mode.

### Q11: One dialog or two for mode + commit selection?
**A:** Two separate dialog pushes — mode selector first, then commit picker on top.

### Q12: Commit picker initial list size?
**A:** 30 recent commits on open. `onFilter` calls `git.commit.search()` for filtering.

### Q13: `v` behavior in review mode?
**A:** Re-trigger — opens the dialog again to switch to a different review target without exiting first. `esc` exits review mode.

### Q14: Sidebar section headers in review mode?
**A:** Collapse to a single "Review" section with all files — no Conflicts/Staged/Changes split.

### Q15: What should the sidebar header show in review mode?
**A:** Commit/range info — e.g., `Review: a1b2c3d` or `Review: main..HEAD`.

### Q16: Should the 1s polling continue in review mode?
**A:** No, pause polling when `$review.active` is true.

### Q17: What does the commit picker show while loading?
**A:** Show the Select input immediately, list fills in when data arrives.

### Q18: How to adapt sidebar utilities for review?
**A:** Refactor utils to accept `CategorizedFiles | null` directly. Current `GitRepoStatus` signatures become thin wrappers.

### Q19: Sidebar visibility in review mode?
**A:** Always show the sidebar (in both worktree and review mode). Remove the `hasChanges()` gate.

### Q20: DiffPane blank view in review mode?
**A:** Show "no changes in this review" instead of "worktree is clean".

---

## Plan

### New files

| File | Purpose |
|---|---|
| `src/store/review.store.ts` | Solid store managing review lifecycle |
| `src/component/review/mode-select.tsx` | Dialog 1: mode picker ("Commit" / "Since Commit") |
| `src/component/review/commit-picker.tsx` | Dialog 2: commit search + Select component |

### Modified files

| File | Change |
|---|---|
| `src/lib/git/types.ts` | Add `"review"` to `GitFileSection` union |
| `src/store/sidebar/sidebar.store.ts` | Remove `v` → `toggleViewMode` binding |
| `src/component/sidebar/index.tsx` | Data source switch (`$review.active`), single "Review" section, header shows review range, always-visible sidebar, pause polling in review mode |
| `src/component/sidebar/utils.ts` | Refactor `createSidebarSections`, `collectSidebarFiles`, `createSidebarSectionViews` to accept `CategorizedFiles \| null`; add review-mode section builder |
| `src/component/diff-pane/index.tsx` | Data source switch, abstracted diff source helper, different blank view for review mode |
| `src/component/diff-pane/diff.tsx` | Accept diff text/loading state as props instead of hardcoding `git.diff.get()` |
| `src/tui.tsx` | Add global `v` keybinding for opening review dialog |

### `$review.store` schema

```typescript
type ReviewState = {
  active: boolean;
  target: GitReviewTarget | null;
  status: GitReviewStatus | null;
  loading: boolean;
  error: string | null;
};

// Actions:
//   start(target: GitReviewTarget) — sets active, fetches git.review.status(target)
//   stop() — clears all state, returns to worktree mode
```

### Dialog flow

1. `v` → `$dialog.action.show(<ModeSelect />)`
2. `ModeSelect` — a `Select` with `skipFilter: true`, two options ("Commit", "Since Commit"). On select, pushes `<CommitPicker mode={chosen} />` via `$dialog.action.show()`.
3. `CommitPicker`:
   - On mount: fetches 30 recent commits via `git.commit.list({ limit: 30 })`, converts to `SelectOption<GitCommit>[]`
   - Uses `Select` component with `onFilter` calling `git.commit.search(filter)` to fetch filtered results
   - Format: `shortRef  title` (compact)
   - On select: constructs `GitReviewTarget` based on mode, calls `$review.action.start(target)`, closes all dialogs via `$dialog.action.clear()`

### Sidebar in review mode

- **Data source**: `createMemo(() => $review.active ? $review.status : $git.status)`
- **Sections**: Single "Review" section containing all files (no Conflicts/Staged/Changes split)
- **Header**: `Review: {resolution.baseLabel}` or `Review: {revisionRange}`
- **Exit**: `esc` calls `$review.action.stop()` and returns to worktree

### DiffPane changes

- Abstracted diff source: checks `$review.active`, calls `git.review.diff(target, file)` or `git.diff.get(file)`
- `Diff` component receives diff text as a prop (or via resource), not hardcoded to `git.diff.get()`
- Blank view: `"no changes in this review"` when review is active and no file selected

### Keybinding changes

- **Remove**: `v` → `sidebar.view.toggle` from sidebar store
- **Add**: `v` → opens review mode selector dialog (in `tui.tsx`, guarded by `$dialog.stack.length === 0`)
- **Add**: `esc` in review mode → `$review.action.stop()` (in sidebar, guarded by `$review.active`)
- **Polling**: pause the 1s `$git.action.refresh()` interval when `$review.active` is true
