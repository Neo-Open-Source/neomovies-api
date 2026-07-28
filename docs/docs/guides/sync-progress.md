---
sidebar_position: 6
---

# Sync Progress

Cross-device watch progress synchronization. Requires authentication.

## Get All Progress

```http
GET /api/v1/sync/progress
Authorization: Bearer <token>
```

## Upsert Progress

```http
PUT /api/v1/sync/progress
Authorization: Bearer <token>
Content-Type: application/json

{
  "mediaId": 550,
  "mediaType": "movie",
  "progress": 45.5
}
```

For TV shows:

```http
PUT /api/v1/sync/progress
Authorization: Bearer <token>
Content-Type: application/json

{
  "mediaId": 1396,
  "mediaType": "tv",
  "season": 1,
  "episode": 3,
  "progress": 78
}
```

## Delete Progress

```http
DELETE /api/v1/sync/progress
Authorization: Bearer <token>
Content-Type: application/json

{
  "mediaId": 550,
  "mediaType": "movie"
}
```

## Batch Upsert

```http
POST /api/v1/sync/progress/batch
Authorization: Bearer <token>
Content-Type: application/json

{
  "items": [
    { "mediaId": 550, "mediaType": "movie", "progress": 100 },
    { "mediaId": 1396, "mediaType": "tv", "season": 1, "episode": 4, "progress": 15 }
  ]
}
```
