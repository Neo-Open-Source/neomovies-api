---
id: favorites
sidebar_position: 3
---

# Favorites

Manage a list of favorite movies and TV shows. All endpoints require authentication.

## Get List

```bash
GET /api/v1/favorites
Authorization: Bearer <token>
```

```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "media_id": "kp_326",
      "media_type": "movie",
      "title": "The Matrix",
      "poster_url": "https://...",
      "rating": 8.5,
      "year": 1999,
      "created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

## Add to Favorites

The operation is idempotent — repeated calls do not create duplicates.

```bash
POST /api/v1/favorites/326?type=movie
Authorization: Bearer <token>
```

The `type` parameter is `movie` or `tv` (defaults to `movie`).

## Remove from Favorites

```bash
DELETE /api/v1/favorites/326?type=movie
Authorization: Bearer <token>
```

## Check if Favorited

```bash
GET /api/v1/favorites/326/check?type=movie
Authorization: Bearer <token>
```

```json
{
  "success": true,
  "data": { "isFavorite": true }
}
```

## Errors

```bash
# Invalid type
POST /api/v1/favorites/326?type=anime
# { "error": "type must be movie or tv" }
```
