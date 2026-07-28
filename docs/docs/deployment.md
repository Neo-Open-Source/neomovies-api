---
sidebar_position: 3
---

# Deployment

## Local Development

### Prerequisites

- [Bun](https://bun.sh) v1.x
- PostgreSQL

### Setup

```bash
bun install
cp .env.example .env
# Fill in DATABASE_URL, TMDB_*, NEO_ID_*

bun run db:generate
bun run db:migrate
bun run dev
```

API: `http://localhost:3000`

### Tests

```bash
bun test
```

### Documentation

```bash
bun run docs:dev    # development
bun run docs:build  # build
```

## Vercel

Simply push to GitHub and import in Vercel. Configuration is already in `vercel.json`.

Add environment variables from `.env.example` in Vercel dashboard.

### Cron

Vercel Cron runs daily at 4:00 AM:

```
GET /api/v1/cron/imdb-ratings
Authorization: Bearer <CRON_SECRET>
```

## Environment Variables

Required for all platforms:

```bash
DATABASE_URL=
TMDB_API_KEY=
TMDB_ACCESS_TOKEN=
NEO_ID_CLIENT_ID=
NEO_ID_CLIENT_SECRET=
NEO_ID_REDIRECT_URI=
PUBLIC_API_URL=
CRON_SECRET=
```

Optional:

```bash
ALLOHA_TOKEN=
COLLAPS_TOKEN=
CDN_TOKEN=
CDN_PL=
REDAPI_URL=
```

## Docker

```dockerfile
FROM oven/bun:1
WORKDIR /app
COPY . .
RUN bun install && bun run db:generate
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
```

```bash
docker build -t neowatch-api .
docker run -p 3000:3000 --env-file .env neowatch-api
```

## Railway

1. Create project on Railway
2. Connect GitHub repository
3. Add PostgreSQL from Marketplace
4. Set environment variables
5. Deploy

Railway automatically detects Bun.

## Fly.io

`fly.toml`:

```toml
app = "neowatch-api"

[build]

[[services]]
  internal_port = 3000
  protocol = "tcp"

  [[services.ports]]
    port = 80
    handlers = ["http"]

  [[services.ports]]
    port = 443
    handlers = ["tls", "http"]
```

```bash
fly launch
fly deploy
```
