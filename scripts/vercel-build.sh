#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DOCS_DIR="$ROOT_DIR/docs"

# Vercel persists build cache between deployments.
CACHE_ROOT="${VERCEL_CACHE_DIR:-$ROOT_DIR/.vercel/cache}"
NPM_CACHE_DIR="$CACHE_ROOT/npm"
DOCUSAURUS_CACHE_DIR="$CACHE_ROOT/docusaurus"

mkdir -p "$NPM_CACHE_DIR"

if [ -d "$DOCUSAURUS_CACHE_DIR" ]; then
  rm -rf "$DOCS_DIR/.docusaurus"
  cp -R "$DOCUSAURUS_CACHE_DIR" "$DOCS_DIR/.docusaurus"
fi

pushd "$DOCS_DIR" >/dev/null
npm install --prefer-offline --no-audit --cache "$NPM_CACHE_DIR"
npm run build
popd >/dev/null

if [ -d "$DOCS_DIR/.docusaurus" ]; then
  rm -rf "$DOCUSAURUS_CACHE_DIR"
  cp -R "$DOCS_DIR/.docusaurus" "$DOCUSAURUS_CACHE_DIR"
fi
