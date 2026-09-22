{
  description = "NeoWatch API v3 — Bun development environment";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-26.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs =
    {
      self,
      nixpkgs,
      flake-utils,
      ...
    }:
    flake-utils.lib.eachDefaultSystem (
      system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          name = "neowatch-api-ts";

          packages = with pkgs; [
            bun
            prettier
            git
            jq
            curl
            gzip

            openssl
            pkg-config
          ];

          shellHook = ''
            # Prisma engines — NixOS has no precompiled binaries on CDN.
            # Download debian-openssl-1.1.x binaries (glibc-compatible) and point Prisma to them.
            PRISMA_ENGINES_DIR="$HOME/.cache/prisma-engines"
            ENGINE_COMMIT="c2990dca591cba766e3b7ef5d9e8a84796e47ab7"
            TARGET="debian-openssl-1.1.x"

            if [ ! -f "$PRISMA_ENGINES_DIR/schema-engine" ] || [ ! -f "$PRISMA_ENGINES_DIR/libquery_engine.so.node" ]; then
              echo "→ Downloading Prisma engines ($TARGET)..."
              mkdir -p "$PRISMA_ENGINES_DIR"
              curl -sL "https://binaries.prisma.sh/all_commits/$ENGINE_COMMIT/$TARGET/schema-engine.gz" | gunzip > "$PRISMA_ENGINES_DIR/schema-engine" 2>/dev/null
              curl -sL "https://binaries.prisma.sh/all_commits/$ENGINE_COMMIT/$TARGET/libquery_engine.so.node.gz" | gunzip > "$PRISMA_ENGINES_DIR/libquery_engine.so.node" 2>/dev/null
              chmod +x "$PRISMA_ENGINES_DIR/schema-engine"
              echo "→ Prisma engines downloaded."
            fi

            export PRISMA_SCHEMA_ENGINE_BINARY="$PRISMA_ENGINES_DIR/schema-engine"
            export PRISMA_QUERY_ENGINE_BINARY="$PRISMA_ENGINES_DIR/schema-engine"
            export PRISMA_QUERY_ENGINE_LIBRARY="$PRISMA_ENGINES_DIR/libquery_engine.so.node"
            export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

            echo ""
            echo "  neowatch-api-ts  |  bun $(bun --version)"
            echo ""
            echo "  bun install       — install dependencies"
            echo "  bun run dev       — start dev server"
            echo "  bun run typecheck — type-check"
            echo "  bun run lint      — lint"
            echo "  bun run format    — format"
            echo "  bun run test      — run tests"
            echo ""
          '';
        };
      }
    );
}
