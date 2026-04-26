#!/bin/sh
#
# gitcha installer
# downloads the latest binary and installs it to ~/.local/bin
#

set -eu

# -----------------------------------------------------------------------------
# configuration
# -----------------------------------------------------------------------------

REPO="rin-yato/gitcha"

# where to install the binary
PREFIX="${PREFIX:-$HOME/.local}"
BIN_DIR="$PREFIX/bin"

# temporary directory
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT INT TERM

# -----------------------------------------------------------------------------
# helpers
# -----------------------------------------------------------------------------

log()   { printf '%s\n' "$1"; }
die()   { printf 'Error: %s\n' "$1" >&2; exit 1; }

# -----------------------------------------------------------------------------
# detect os and architecture
# -----------------------------------------------------------------------------

ARCH="$(uname -m)"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"

case "$OS" in
    darwin*)               os_name="darwin" ;;
    linux*)                os_name="linux" ;;
    mingw*|msys*|cygwin*) os_name="windows" ;;
    *)                    die "Unsupported platform: $OS" ;;
esac

case "$ARCH" in
    x86_64|amd64)
        if [ "$os_name" = "darwin" ]; then
            die "Intel macOS is not supported by the published releases yet; install with Bun or build from source."
        fi
        arch_name="x64" ;;
    arm64|aarch64) arch_name="arm64" ;;
    *)            die "Unsupported architecture: $ARCH" ;;
esac

# build asset name
if [ "$os_name" = "windows" ]; then
    ASSET="gitcha-$os_name-$arch_name.exe"
else
    ASSET="gitcha-$os_name-$arch_name"
fi

# get latest tag
log "Detecting latest release..."
TAG="$(curl -sL "https://api.github.com/repos/$REPO/releases/latest" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')"
[ -n "$TAG" ] || die "Failed to resolve the latest release tag"

# download directly using tag + asset name
URL="https://github.com/$REPO/releases/download/$TAG/$ASSET"

log "Downloading $ASSET..."
curl -L --fail -o "$TMP/$ASSET" "$URL" || die "Failed to download $ASSET"

# install
mkdir -p "$BIN_DIR"
cp "$TMP/$ASSET" "$BIN_DIR/$ASSET"

if [ "$os_name" = "windows" ]; then
    printf '@echo off\r\n"%%~dp0%s" %%*\r\n' "$ASSET" > "$BIN_DIR/gitcha.cmd"
    cp "$BIN_DIR/gitcha.cmd" "$BIN_DIR/gc.cmd"
else
    install -m 755 "$TMP/$ASSET" "$BIN_DIR/$ASSET"
    if [ "$os_name" = "darwin" ] && command -v xattr >/dev/null 2>&1; then
        xattr -d com.apple.quarantine "$BIN_DIR/$ASSET" 2>/dev/null || true
    fi
    ln -sf "$BIN_DIR/$ASSET" "$BIN_DIR/gitcha"
    ln -sf "$BIN_DIR/$ASSET" "$BIN_DIR/gc"
fi

log "Installed gitcha and gc to $BIN_DIR"
