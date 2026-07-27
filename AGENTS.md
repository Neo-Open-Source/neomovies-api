# AGENTS.md — NeoWatch API

## Project

Rust REST API for NeoWatch. Axum 0.8, MongoDB, Neo ID SSO, Kinopoisk API.
Deployed on Vercel (serverless) and Netlify (docs only).

## Stack

| Layer | Choice |
|-------|--------|
| Language | Rust (edition 2024) |
| Web framework | Axum 0.8 |
| Serverless | `vercel_runtime` (dual-path: axum for local, `api/index.rs` for Vercel) |
| Database | MongoDB via `mongodb` crate |
| Auth | Neo ID SSO, JWT HS256 with refresh rotation |
| External APIs | Kinopoisk Unofficial (media data), TMDB (episode descriptions, ratings) |
| Image proxy | Kinopoisk CDN → local cache path |
| Video players | Alloha, Lumex, Vibix, HDVB, Collaps |
| Torrents | RedAPI |
| Testing | `proptest` (property-based) |

## Domain

- `https://api.neome.uk` — production API
- `https://neome.uk` — main site
- `https://id.neome.uk` — Neo ID SSO

## Architecture

### Route registration (dual-path)

**Local dev** (`cargo run --bin server`):
- Axum `Router` in `src/server.rs` with `route()` calls
- Handlers called via `from_vercel(handler(...).await).await`

**Vercel production** (`api/index.rs`):
- Single serverless function, `?route=` param dispatches to handler
- Rewrites in `vercel.json` map paths to `api/index?route=...`

Both paths call the same `handle_*` functions.

### Response helpers (`src/response.rs`)

- `success(data)` → `{ success: true, data: ... }`
- `error_response(...)` → `{ error: "..." }`
- `with_cors(resp)` — adds CORS headers
- Always wrap in `with_cors()`

### MongoDB models

Each model has:
- Struct with `#[serde(rename_all = "camelCase")]` + `_id` field
- `fn collection(db) -> Collection<T>`
- `async fn ensure_indexes(db)` — unique compound indexes

Current models:
- `user` — `User`, `RefreshToken`
- `favorite` — `{ user_id, media_id, media_type }` unique
- `watch_later` — same shape, separate collection
- `sync_progress` — `{ user_id, media_id, season, episode }` unique

### API versioning

| Path | Purpose |
|------|---------|
| `/api/v1/*` | Legacy, backward-compatible |
| `/api/v2/*` | Cleaner responses, new features |

### Key differences v1 → v2

- `MediaDetailsV2Dto` vs `MediaDetailsDto`:
  - v2 has no `sourceId` dup, no separate `rating` field
  - v2 `genres` is `String[]`, not `[{id, name}]`
  - v2 `countries` is `String[]` (all), v1 `country` is first only
  - v2 `ids` consolidates external IDs, v1 splits across `externalIds`
  - v2 uses `poster`/`backdrop` (shorter), v1 uses `posterUrl`/`backdropUrl`

## File structure

```
src/
  handlers/         — one file per domain (auth, media, search, ...)
  models/           — MongoDB document structs
  services/         — external API clients (kinopoisk, tmdb, neoid, ...)
  server.rs         — axum router + route functions
  response.rs       — response helpers
  lib.rs            — crate root
  db.rs             — MongoDB connection
api/
  index.rs          — Vercel serverless entrypoint
tests/
  prop_*.rs         — proptest-based tests
docs/               — Docusaurus docs site (not maintained by agent)
```

## Vercel deployment

- Each deploy compiles `api/index.rs` as a single serverless function
- `vercel.json` has all rewrite rules mapping paths to `?route=`
- Environment variables set in Vercel dashboard (not committed)
- `Cargo.toml` configures `lambda` feature for `vercel_runtime`

## Design decisions

- **Conflict resolution (sync progress)**: Last write wins by `updated_at` timestamp
- **Idempotent add**: Upsert with `$setOnInsert` for favorites/watch_later
- **Image proxy**: Rewrite Kinopoisk CDN URLs to local `/api/v1/images/...` paths
- **CORS**: Allow all origins (`*`)
- **Auth**: Neo ID SSO only, no email/password. JWT with refresh rotation.

## Testing

- `cargo test` runs all proptest suites
- Tests verify model invariants, not HTTP
- Use `proptest!` macro with `ProptestConfig::with_cases(N)`

## Session log

### 2026-07-13: v2 API features + docs + sync progress

- Added `GET /api/v2/search` — filtered search (genre, year, rating, keyword, type, country, order)
- Added `GET /api/v2/movie/{kp_id}` — clean detail response (no duplicate fields)
- Added `GET /api/v1/genres` — list all genres from Kinopoisk
- Added `GET /api/v1/category/{genre_id}` — films/TV by genre with `?films`/`?tv` filters
- Added `GET/POST/DELETE /api/v1/watch-later/{kp_id}` + check — watch later CRUD with MongoDB
- Added `GET/PUT/DELETE /api/v1/sync/progress` + `POST /api/v1/sync/progress/batch` — cross-device watch tracking with last-write-wins conflict resolution
- Created `MediaDetailsV2Dto` — cleaner struct without `sourceId`/`rating` duplicates
- Migrated all domains from `neomovies.ru`/`neomovies.run` → `neome.uk`
- Updated `openapi.yaml`, `README.md`, `docs/static/openapi.yaml`
- Created `CONTRIBUTING.md`, `AGENTS.md`
- 5 property-based tests for sync progress
