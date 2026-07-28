---
sidebar_position: 5
---

# Favorites

Manage user favorites. Requires authentication.

## List Favorites

```http
GET /api/v1/favorites
Authorization: Bearer <token>
```

## Add Favorite

```http
POST /api/v1/favorites/550
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "clx...",
    "userId": "...",
    "mediaId": 550,
    "mediaType": "movie",
    "createdAt": "2024-01-01T00:00:00.000Z"
  }
}
```

## Remove Favorite

```http
DELETE /api/v1/favorites/550?mediaType=movie
Authorization: Bearer <token>
```

## Check Favorite

```http
GET /api/v1/favorites/550/check?mediaType=movie
Authorization: Bearer <token>
```

Response:
```json
{
  "success": true,
  "data": {
    "isFavorite": true
  }
}
```
