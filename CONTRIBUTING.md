# Contributing to NeoMovies API

## Project overview

REST API built with Rust + Axum 0.8, deployed as Vercel serverless functions.
MongoDB for persistence, Neo ID SSO for authentication, Kinopoisk API for media data.

## Getting started

```bash
cp .env.example .env
# fill in your keys
cargo run --bin server
```

## Code conventions

### Rust

- Use `camelCase` for JSON fields (`#[serde(rename_all = "camelCase")]`)
- Keep handlers thin: parse input, call a service, return response
- All API responses wrap in `{ success: true, data: ... }` or `{ error: "..." }`
- Use `with_cors(success(...))` for success, `with_cors(error_response(...))` for errors
- `use crate::{bad_request, internal_error, not_found, success, with_cors};`

### Adding a new endpoint

1. **Handler** — `src/handlers/<name>.rs` — takes typed params, returns `Response<ResponseBody>`
2. **Model** (if DB) — `src/models/<name>.rs` — MongoDB document struct + collection/index helpers
3. **Service** (if upstream API) — `src/services/<name>.rs` — client wrapper
4. **Register** — add `pub mod <name>;` in `src/handlers/mod.rs` and/or `src/models/mod.rs`
5. **Route** — add route function + `.route(...)` in `src/server.rs`
6. **Vercel** — add route match in `api/index.rs` + rewrite in `vercel.json`

### API versioning

- `/api/v1/*` — stable, backward-compatible (supports old frontend)
- `/api/v2/*` — improved response shapes, cleaner DTOs
- New features go to v2 first; v1 is legacy

### Testing

- Property-based tests with `proptest` in `tests/`
- Test the model logic and invariants, not HTTP
- Name pattern: `prop_<feature>.rs`

### Models

- Unique compound index on `{ user_id, media_id, ... }` for user-scoped resources
- Use `ensure_indexes()` called on first write

## Commit style

Logical commits, not too granular. Example:

- `Add watch_later model and CRUD endpoints`
- `Migrate domains from X to Y`
- `Update API docs — add v2 endpoints, genres, ...`
