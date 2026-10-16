#!/data/data/com.termux/files/usr/bin/bash
set -eu

echo "Installing WinAgent for Termux..."
pkg update -y
pkg install -y nodejs termux-api
termux-setup-storage || true

ROOT="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
cd "$ROOT"
mkdir -p memory

echo
echo "WinAgent is ready. Run:"
echo "  node src/index.js \"check Android status\""
echo "  node src/index.js \"list files in Downloads\""
