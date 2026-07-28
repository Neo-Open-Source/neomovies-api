# NeoWatch API v3 — LLM Context

## Project

NeoWatch API v3 is a REST API for streaming movies and TV shows. It replaces the Rust-based v2 with a TypeScript stack for faster iteration.

## Stack

| Category | Technology |
|----------|-----------|
| Runtime | Bun 1.x |
| Framework | Elysia 1.x |
| Database | PostgreSQL 16 (Neon) |
| ORM | Prisma 6 |
| Auth | Neo ID (SSO, OAuth 2.0, OIDC) |
| Metadata | TMDB API v3 |
| Deployment | Vercel (serverless) |

## Architecture

### Route → Service → External API

```
Elysia Router (routes/)
  → Business Logic (services/)
    → External APIs (TMDB, Neo ID, etc.)
    → Database (Prisma)
  → Response (lib/response.ts)
```

### Error Handling

Custom error classes in `lib/errors.ts` are thrown by handlers/services and caught by the `onError` handler in `app.ts`. This ensures consistent error responses with correct HTTP status codes.

- `AppError(statusCode, message)` — base class
- `UnauthorizedError` → 401
- `NotFoundError` → 404
- `BadRequestError` → 400
- `ForbiddenError` → 403

### Response Format

All endpoints return:
```json
{ "success": true, "data": ... }
{ "success": false, "error": "message" }
```

Pagination:
```json
{ "success": true, "data": { "items": [...], "page": 1, "totalPages": 5, "totalResults": 100 } }
```

### Auth Flow

1. Client calls `GET /api/v1/auth/login` → receives Neo ID authorize URL
2. User authorizes in browser → redirected to `/api/v1/auth/callback`
3. Server exchanges code for tokens, sets cookies, redirects to frontend
4. Auth middleware verifies JWT from `Authorization: Bearer <token>` header
5. Decoded user info attached to request context (`userId`, `userEmail`, `userRole`)

### Key Design Decisions

- **Dual deployment**: Local dev via `Bun.serve()`, production via Vercel serverless (`api/index.ts`)
- **Validation**: Elysia's `t.Object()` for request validation; avoid raw `as` casts
- **No `any` types**: All mapper functions use proper TypeScript interfaces
- **No silent error swallowing**: `.catch(() => {})` is replaced with proper error handling
- **Token safety**: API tokens are never exposed to clients; player URLs are server-side proxied

## File Structure

```
src/
  index.ts              # Bun.serve entrypoint
  app.ts                # Elysia app, route mounting, onError handler
  config.ts             # Config from env
  db.ts                 # Prisma singleton
  types/
    api.ts              # API response DTOs
    tmdb.ts             # TMDB API types
  lib/
    errors.ts           # AppError classes
    response.ts         # success() helper
    jwt.ts              # JWKS-based JWT verification
    mappers.ts          # TMDB → API response mappers
    query.ts            # Page param helper
    language.ts         # Language param helper
    images.ts           # Image size constants
  middleware/
    auth.ts             # JWT auth middleware
  routes/               # One file per domain
    auth.ts, media.ts, search.ts, genres.ts,
    categories.ts, favorites.ts, watch-later.ts,
    sync.ts, players.ts, images.ts, torrents.ts,
    support.ts, health.ts, cron.ts, webhooks.ts
  services/             # Business logic / API clients
    tmdb.ts, media.ts, neoid.ts, user-data.ts,
    alloha.ts, cdn.ts, imdb-ratings.ts
  __tests__/            # Tests
prisma/
  schema.prisma         # DB schema
api/
  index.ts              # Vercel serverless entrypoint
docs/                   # Docusaurus site
```

## Vercel Deployment

`api/index.ts` exports `app.fetch` as the serverless handler. `vercel.json` rewrites all routes to this handler.

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| TypeScript over Rust | Faster iteration, easier maintenance, same team tools |
| Elysia over Express | Built-in validation, TypeScript-first, lightweight |
| Prisma over Drizzle | Mature, excellent migrations, type-safe queries |
| PostgreSQL over MongoDB | Relational data (users, favorites, sync) benefits from ACID |
| Neo ID SSO | Centralized auth across Neo Team services |

## Testing

- **Framework**: Bun built-in test runner
- **Pattern**: Integration tests for routes, unit tests for mappers/utils
- **No mocking**: Tests run against real endpoints with controlled inputs

## Session Log

*2026-07-29*: Initial cleanup — documentation, code style, error handling fixes.
