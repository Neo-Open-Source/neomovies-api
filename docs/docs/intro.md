---
id: intro
slug: /
sidebar_position: 1
---

# NeoMovies API v2

NeoMovies API v2 is a serverless REST API built in Rust, deployed on Vercel.

## Key Features

- **Authentication** — via [Neo ID SSO](https://id.neome.uk) only
- **Media data** — Kinopoisk API and TMDB
- **Database** — MongoDB (users, favorites, watch later, sync progress, refresh tokens)
- **Deployment** — Vercel Serverless Functions (Rust)
- **CORS** — allowed for all origins (`*`)
- **v2** — cleaner media details, filtered search

## Base URLs

```
https://api.neome.uk/api/v1   (legacy, backward-compatible)
https://api.neome.uk/api/v2   (new, cleaner responses)
```

## Response Format

All endpoints return JSON. Successful responses are wrapped in an envelope:

```json
{
  "success": true,
  "data": { ... }
}
```

Errors:

```json
{
  "error": "error description"
}
```

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad request |
| 401 | Unauthorized |
| 404 | Not found |
| 500 | Internal server error |
| 502 | Upstream service error |
