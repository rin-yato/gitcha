# gitcha

An early-preview Git UI for the terminal.

## About

`gitcha` is a terminal UI for source control review, modeled after the workflow people know from VS Code's Source Control panel.

It supports branch-based diff review, so you can inspect changes the way you would review a PR or MR before merging.

This project was built for an AI-heavy workflow, where it's important to be able to easily review the changes made by codeing agents.

With `gitcha`, the goal is to make that final review fast and focused.

## Current Focus

- Source control overview for staged, unstaged, and untracked files
- Branch-based diff review for PR/MR-style inspection
- A VS Code-like source control workflow in the terminal
- Keyboard navigation with `h/j/k/l` or arrow keys
- More workflow features are being built out

## Configuration

`gitcha` reads config from `~/.config/gitcha/gitcha.json` on startup.

Supported keys:

| Key | Type | Default | Description |
|---|---|---|---|
| `theme` | string | `"opencode"` | Theme ID (see available themes) |
| `themeMode` | `"light"` \| `"dark"` | `"light"` | Light or dark mode |
| `sidebar.defaultOpen` | boolean | `true` | Whether sidebar starts open |
| `sidebar.defaultWidth` | number | `40` | Default sidebar width in columns |
| `window.paddingTop` | number | `0` | Top padding |
| `window.paddingRight` | number | `0` | Right padding |
| `window.paddingBottom` | number | `0` | Bottom padding |
| `window.paddingLeft` | number | `0` | Left padding |

## Quick Start

If you already have Bun installed, you can install or run `gitcha` directly:

```bash
# Installation
bun add -g gitcha
bunx gitcha

gitcha # usage
```

If you do not have Bun installed, use the install script instead:

```bash
curl -fsSL https://raw.githubusercontent.com/rin-yato/gitcha/main/install.sh | sh
```

On macOS, the published releases currently support Apple Silicon only. Intel Macs will need to build from source until x64 release assets return.

Run `gitcha` from any git repository to get started.

## Status

`gitcha` is a preview project. The interface and feature set are expected to change as development continues.

## Contributing

Contributions are welcome. See [AGENTS.md](AGENTS.md) for development workflow details.

## License

MIT. See [LICENSE](LICENSE) for details.
