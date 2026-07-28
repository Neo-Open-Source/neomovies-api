# Contributing to NeoWatch API

## Project Overview

NeoWatch API v3 is a REST API for streaming movies and TV shows. Built with TypeScript, Bun, Elysia, Prisma, and PostgreSQL.

## Getting Started

```bash
git clone https://github.com/Neo-Open-Source/neomovies-api.git
cd neowatch-api-ts
cp .env.example .env
bun install
bun run db:generate
bun run db:migrate
bun run dev
```

## Code Conventions

### General

- **Language**: TypeScript with strict mode
- **Runtime**: Bun 1.x
- **Framework**: Elysia 1.x — handlers should be thin, delegating to services
- **Database**: Prisma ORM with PostgreSQL
- **JSON fields**: `camelCase` (TypeScript convention)
- **API paths**: `/api/v1/<resource>`

### Handler Pattern

```
route → validate input → call service → return response
```

Handlers should:
- Parse and validate input using Elysia's `t.Object()` schema
- Call the appropriate service function
- Return a response via the `success()` helper
- Throw `AppError` subclasses for error cases

### Error Handling

Use the predefined error classes in `src/lib/errors.ts`:

```typescript
import { NotFoundError, BadRequestError, UnauthorizedError } from "../lib/errors"

// In a handler:
if (!userId) throw new UnauthorizedError()
if (!result) throw new NotFoundError("Movie")
```

All `AppError` instances are caught by the centralized `onError` handler in `app.ts` and converted to proper JSON responses with correct HTTP status codes.

### Response Format

```typescript
import { success } from "../lib/response"

// Success
return success({ id: 1, title: "Movie" })
// → { success: true, data: { id: 1, title: "Movie" } }
```

### Route Registration

Create routes with `prefix` for grouping:

```typescript
import { Elysia, t } from "elysia"
import { success } from "../lib/response"
import { NotFoundError } from "../lib/errors"

export const myRoutes = new Elysia({ prefix: "/api/v1/items" })
  .get("/", async ({ query }) => {
    const items = await service.list()
    return success(items)
  })
  .get("/:id", async ({ params: { id } }) => {
    const item = await service.getById(id)
    if (!item) throw new NotFoundError("Item")
    return success(item)
  }, { params: t.Object({ id: t.Numeric() }) })
```

### Adding a New Endpoint

1. Add the handler to the appropriate file in `src/routes/`
2. Add business logic to `src/services/`
3. Update types in `src/types/` if needed
4. Add validation schemas
5. Mount the route in `src/app.ts`
6. Update the OpenAPI spec: `bun run docs:generate`
7. Add tests in `src/__tests__/`

### API Versioning

- All endpoints live under `/api/v1/`
- Breaking changes require a new version (`/api/v2/`)

### Code Style

- **Formatter**: Biome (2 spaces, single quotes, semicolons)
- **Linter**: Biome with recommended rules
- **TypeScript**: Strict mode, no `any` types
- **Imports**: Use `import type` for type-only imports

```bash
bunx biome check --write src/
bunx biome lint src/
bun run typecheck
```

## Testing

```bash
bun test
```

Follow existing test patterns:
- Integration tests for routes
- Unit tests for mappers and utilities
- No test dependencies on external services

## Commit Style

- Use conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `chore:`, `test:`, `style:`
- Keep commits logical and focused
- Example: `feat: add TV season details endpoint`

## API Documentation

Docs are built with Docusaurus 3 and hosted on Vercel.

```bash
bun run docs:dev    # Local dev
bun run docs:build  # Production build
bun run docs:generate # Update OpenAPI spec
```
