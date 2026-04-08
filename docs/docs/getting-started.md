---
id: getting-started
sidebar_position: 2
---

# Getting Started

## 1. Get a Token

Authentication is done via Neo ID. See [Authentication](./authentication) for details.

Quick flow:

```bash
# 1. Get the login URL
curl -X POST https://api.neomovies.ru/api/v1/auth/neo-id/login \
  -H "Content-Type: application/json" \
  -d '{"redirect_url":"https://yourapp.com/callback","state":"random_state"}'

# Response:
# { "login_url": "https://id.neomovies.ru/..." }
```

The user visits `login_url`, authenticates, and Neo ID redirects back with an `access_token`.

```bash
# 2. Exchange the Neo ID token for a JWT
curl -X POST https://api.neomovies.ru/api/v1/auth/neo-id/callback \
  -H "Content-Type: application/json" \
  -d '{"access_token":"<neo_id_token>"}'

# Response:
# { "accessToken": "eyJ...", "refreshToken": "a3f..." }
```

## 2. Make a Request

Pass the `accessToken` in the `Authorization` header:

```bash
curl https://api.neomovies.ru/api/v1/auth/profile \
  -H "Authorization: Bearer eyJ..."
```

## 3. Refresh the Token

The access token lives for **15 minutes**. Refresh it using the refresh token:

```bash
curl -X POST https://api.neomovies.ru/api/v1/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"a3f..."}'
```

## Search for Films

```bash
curl "https://api.neomovies.ru/api/v1/search?query=matrix"
```

## Film Details

```bash
# By numeric Kinopoisk ID
curl https://api.neomovies.ru/api/v1/movie/326

# Or with prefix
curl https://api.neomovies.ru/api/v1/movie/kp_326
```
