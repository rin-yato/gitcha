# GitTUIhel

A highly interactive, blazing-fast Git terminal user interface built with TypeScript and [OpenTUI](https://opentui.com/). Heavily inspired by the VS Code Source Control tab, this project brings granular diffing and seamless commit workflows directly to the terminal.

## 🎯 Project Goal

To provide a feature-rich, keyboard-centric Git workflow with an easy-to-understand UX. The UI must be modern, minimalist, and distraction-free, prioritizing clean layouts, thoughtful spacing, and muted, intentional color palettes.

## 🛠️ Tech Stack

- **Runtime:** Bun
- **Language:** TypeScript
- **UI Framework:** `@opentui/core` (utilizing React or Solid bindings)

## ✨ Core Features

### 1. VS Code-Style Source Control Panel

- **Categorized File Trees:** Automatically group files into "Staged Changes", "Changes", and "Untracked Files".
- **Interactive Tree:** Expandable/collapsible directories.
- **Quick Actions:** Single-keystroke commands to stage (`s`), unstage (`u`), or discard (`x`) files directly from the tree view.

### 2. Advanced Diffing Engine

- **Contextual Diff Views:** Seamlessly toggle between Inline and Side-by-Side diffing utilizing OpenTUI's `Diff`, `Code`, and `Line numbers` components.
- **Syntax Highlighting:** Integrated Tree-sitter support for accurate, aesthetic code coloring.
- **Granular Staging:** Ability to navigate through individual diff hunks and stage/unstage them dynamically.

### 3. Streamlined Commit Workflow

- **Integrated Input:** A dedicated, multi-line OpenTUI `Textarea` for drafting commit messages.
- **Commit History:** A collapsible side-panel to view the recent commit log.
- **Quick Push/Pull:** Bindings to immediately sync with the remote after a successful commit.

### 4. Modern & Minimalist UX/UI

- **Vim-Inspired Keybindings:** Native `h/j/k/l` navigation alongside standard arrow keys for power users.
- **Clean Borders & Layouts:** Use OpenTUI's `Box` component to create rounded, unobtrusive borders (`borderStyle: "rounded"`).
- **Responsive Flexbox Layout:** Ensure the interface scales gracefully across different terminal window sizes without breaking the diff views.

## 🚀 AI Agent Implementation Milestones

- ✅ **Phase 1 - Bootstrap Project:** Initialize Bun, install `@opentui/core`, and set up the basic layout shell (Left Sidebar for files, Right Panel for diffs).
- ✅ **Phase 2 - Git Integration:** Implement the underlying Node/Bun `child_process` logic to parse `git status` and populate the Source Control Panel.
- ✅ **Phase 3 - Build the Diff View:** Hook up OpenTUI's `Diff` component to render `git diff` outputs for the currently selected file.
- **Phase 4 - Interactivity & State:** Implement state management for staging/unstaging and bind keys for navigation.
- **Phase 5 - Commit Interface:** Build the input box, capture the message, and execute the `git commit` command.

## Build and Install

### Local build

```sh
bun run build
```

This generates a compiled macOS binary in `dist/sourcery` using Bun compile and the OpenTUI Solid Bun plugin.

### Install on macOS

```sh
bun run install:local
```

By default, this installs the compiled binary to `~/.local/bin/sourcery`. Set `PREFIX` to change the install location.

## 📁 Project Structure

```
src/
├── git/              # Git integration module
│   ├── index.ts      # Main exports
│   ├── types.ts      # Type definitions
│   ├── commands.ts   # Git command wrappers
│   └── parser.ts     # Status parsing logic
├── styles/           # Theme and styling
│   └── theme.tsx
├── constants/        # Constants
│   └── theme.ts
└── index.tsx         # Main application entry
