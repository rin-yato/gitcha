# Gitcha

A terminal UI for reviewing git changes, modeled after VS Code's Source Control panel.

## Language

**Workspace**:
The default operating mode showing the current worktree's git status — staged, unstaged, and untracked files.
_Avoid_: Default mode, status view

**Review**:
A mode for inspecting changes between git refs, either the contents of a single commit or all changes since a base commit.
_Avoid_: PR review, code review

**Conflicts**:
Files with merge conflicts that need resolution.
_Avoid_: Merge conflicts, conflicted

**Staged**:
Files staged for the next commit.

**Changes**:
Unstaged modifications and untracked files, shown together as a single section.
_Avoid_: Unstaged, Untracked (as section names)

**Ex Command**:
A command prompt opened with `:` for running app commands (`:quit`, `:refresh`, `:sidebar`) and arbitrary git commands (`:git commit -m "..."`).
_Avoid_: Command palette, shell

**Commit Review**:
A review sub-mode that inspects the changes introduced by a single commit (its diff against its parent).
_Avoid_: Single commit mode

**Base Commit Review**:
A review sub-mode that inspects all changes since a chosen base commit, optionally up to a specific compare ref.
_Avoid_: Since commit mode, range review
