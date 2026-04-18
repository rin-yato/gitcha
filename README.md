# changes

Git, reimagined for the terminal.

## About

`changes` brings a clean, modern interface to your daily Git workflow. Thoughtful spacing. Muted, intentional colors. Clean layouts that let you focus on what matters — your code.

Everything is keyboard-driven. Navigate files, review diffs, stage hunks, and write commits — all without leaving the terminal.

## Features

- **Source Control Panel** — See staged, unstaged, and untracked files at a glance
- **Diff Views** — Review changes with syntax-highlighted, side-by-side or inline diffs
- **Granular Staging** — Stage exactly what you want, one hunk at a time
- **Commit Workflow** — Write messages, push, and pull — seamlessly
- **Vim-Style Navigation** — Move fast with `h/j/k/l` or arrow keys

## Quick Start

```bash
curl -fsSL https://raw.githubusercontent.com/rin-yato/changes/main/install.sh | sh
```

Run `ch` from any git repository to get started.

### Requirements

- **macOS**, **Linux**, or **Windows**
- **Bun** >= 1.0 for development

### Install

```bash
PREFIX=$HOME/.local curl -fsSL https://raw.githubusercontent.com/rin-yato/changes/main/install.sh | sh
```

## Development

```bash
bun run dev     # Start development mode
bun run build   # Build production binary
bun run fix     # Format and lint
bun test        # Run tests
```

## Contributing

Contributions are welcome. See [AGENTS.md](AGENTS.md) for development workflow details.

## License

MIT. See [LICENSE](LICENSE) for details.
