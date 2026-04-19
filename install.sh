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
    x86_64|amd64) arch_name="x64" ;;
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

# download directly using tag + asset name
URL="https://github.com/$REPO/releases/download/$TAG/$ASSET"

log "Downloading $ASSET..."
curl -L --fail -o "$TMP/$ASSET" "$URL" || die "Failed to download $ASSET"

# install
mkdir -p "$BIN_DIR"
cp "$TMP/$ASSET" "$BIN_DIR/$ASSET"

if [ "$os_name" = "windows" ]; then
    printf '@echo off\r\n"%%~dp0%q" %%*\r\n' "$ASSET" > "$BIN_DIR/gitcha.cmd"
else
    chmod +x "$BIN_DIR/$ASSET"
    ln -sf "$BIN_DIR/$ASSET" "$BIN_DIR/gitcha"
fi

log "Installed to $BIN_DIR/$ASSET"
