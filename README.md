# differ

Git, reimagined for the terminal.

## About

`differ` brings a clean, modern interface to your daily Git workflow. Thoughtful spacing. Muted, intentional colors. Clean layouts that let you focus on what matters - your code.

Everything is keyboard-driven. Navigate files, review diffs, stage hunks, and write commits — all without leaving the terminal.

## Features

- **Source Control Panel** — See staged, unstaged, and untracked files at a glance
- **Diff Views** — Review changes with syntax-highlighted, side-by-side or inline diffs
- **Granular Staging** — Stage exactly what you want, one hunk at a time
- **Commit Workflow** — Write messages, push, and pull — seamlessly
- **Vim-Style Navigation** — Move fast with `h/j/k/l` or arrow keys

## Quick Start

If you already have Bun installed, you can install or run `differ` directly:

```bash
# Installation
bun add -g differ
bunx differ

differ # usage
```

If you do not have Bun installed, use the install script instead:

```bash
curl -fsSL https://raw.githubusercontent.com/rin-yato/differ/main/install.sh | sh
```

Run `differ` from any git repository to get started.

## Contributing

Contributions are welcome. See [AGENTS.md](AGENTS.md) for development workflow details.

## License

MIT. See [LICENSE](LICENSE) for details.
