#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Build admin panel
echo ":: Building admin panel..."
cd "$ROOT_DIR/admin-panel"
npm ci --omit=dev && npm run build

# Copy to public/ so Vercel serves static files for /admin/*
echo ":: Copying admin panel to public/..."
mkdir -p "$ROOT_DIR/public/admin"
cp -r "$ROOT_DIR/admin-panel/dist/"* "$ROOT_DIR/public/admin/"

# Build docs
bash "$ROOT_DIR/scripts/build-docs.sh"
