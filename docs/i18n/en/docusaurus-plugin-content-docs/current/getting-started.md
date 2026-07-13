---
id: getting-started
sidebar_position: 2
---

# Getting Started

## Base URLs

- Production API: `https://api.neome.uk/api/v1`
- Local API (Axum): `http://localhost:3000/api/v1`

## 1. Get a Token

Authentication is done via Neo ID. See [Authentication](./authentication) for details.

Quick flow:

```bash
# 1. Get the login URL
curl -X POST https://api.neome.uk/api/v1/auth/neo-id/login \
  -H "Content-Type: application/json" \
  -d '{"redirect_url":"https://yourapp.com/callback","state":"random_state"}'

# Response:
# { "login_url": "https://id.neome.uk/..." }
```

The user opens `login_url`, authenticates, and Neo ID redirects back with an `access_token`.

```bash
# 2. Exchange the Neo ID token for API tokens
curl -X POST https://api.neome.uk/api/v1/auth/neo-id/callback \
  -H "Content-Type: application/json" \
  -d '{"access_token":"<neo_id_token>"}'

# Response:
# { "accessToken": "eyJ...", "refreshToken": "a3f..." }
```

## 2. Make a Request

Pass `accessToken` in the `Authorization` header:

```bash
curl https://api.neome.uk/api/v1/auth/profile \
  -H "Authorization: Bearer eyJ..."
```

## 3. Refresh the Token

Access token lifetime is **15 minutes**:

```bash
curl -X POST https://api.neome.uk/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"a3f..."}'
```

## Search

```bash
# v1 — keyword search
curl "https://api.neome.uk/api/v1/search?query=matrix"

# v2 — filtered search
curl "https://api.neome.uk/api/v2/search?keyword=matrix&genre=1&order=RATING"
```

## Media Details

```bash
# v1 — legacy details
curl https://api.neome.uk/api/v1/movie/326

# v2 — clean response (no duplicate fields)
curl https://api.neome.uk/api/v2/movie/kp_326
```

## Genres & Categories

```bash
# List all genres
curl https://api.neome.uk/api/v1/genres

# Films by genre (genre_id from /genres)
curl "https://api.neome.uk/api/v1/category/1?films&order=RATING"

# TV series by genre
curl "https://api.neome.uk/api/v1/category/1?tv&order=RATING"
```

## Notes About Docs URLs

- On Vercel, docs are served at `/` by rewrite.
- In local development, docs are served by Docusaurus (typically `/docs`), not by the Axum API server.
